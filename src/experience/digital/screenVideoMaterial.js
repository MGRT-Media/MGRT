import * as THREE from 'three'

/**
 * The Phase 2 Digital screen material — samples a `THREE.VideoTexture`
 * instead of the Phase 1D procedural test pattern, but keeps the exact
 * same dormant/ignite behavior: an unlit `ShaderMaterial` (`toneMapped:
 * false`) blending between a near-black dormant glass look and the live
 * video frame via `uIgnite`, driven by each caller's own
 * scrollProgress-based ignite wiring — untouched by this module.
 *
 * `uVideoAspect`/`uTargetAspect` drive a standard "cover" UV remap (crop
 * to fill, never stretch) — added per explicit request to eliminate
 * visible dead space between the video and its housing (CinemaCamera's
 * circular lens aperture, `targetAspect` ~1, versus the source clip's
 * native ~16:9). `targetAspect` is fixed at construction (the mesh's own
 * aspect ratio doesn't change at runtime); `uVideoAspect` starts at a
 * reasonable 16:9 default and callers update it once the video element's
 * real dimensions are known (`loadedmetadata`), since that's the only
 * piece not known synchronously when the material is created.
 *
 * `lensEffect` (default off) adds two optical touches for the Cinema
 * Camera's square Film preview: a subtle barrel distortion (the image bends
 * very slightly toward the edges, like light through curved glass) and an
 * alpha fade toward its four straight edges, so the picture dissolves into
 * whatever is really behind it instead of ending in a dark border. That fade
 * is why the material is transparent (and skips depth writes) only with
 * `lensEffect` on. `Monitor.jsx`'s screen keeps this off, the default, so it
 * stays opaque and its own `<video>` texture is untouched by either effect. Deliberately a uniform toggle rather than two separate shader
 * variants: the only thing that differs between callers is ON/OFF, not
 * the tuning, so a single shared shader with a branch is simpler than
 * maintaining two.
 */
export function createScreenVideoMaterial(
  videoTexture,
  targetAspect = 1,
  { lensEffect = false, coverTransmittance = 1 } = {},
) {
  return new THREE.ShaderMaterial({
    // `toneMapped` here does NOT mean "tone-map this material" — the shader
    // below never includes `<tonemapping_fragment>`, so the direct view of
    // the screen is written exactly as raw as it always was. It is set so
    // that Three defines `TONE_MAPPING` when this material is drawn to the
    // canvas and leaves it undefined when it is drawn into a render target,
    // which is the only reliable way for the shader to tell which pass it is
    // in. See the `#ifdef TONE_MAPPING` at the bottom of the fragment shader
    // for why that matters.
    toneMapped: true,
    // Straight (not premultiplied) alpha with normal blending: a faded edge
    // shows the video's own colour at reduced coverage, so it thins out over
    // the scene rather than darkening into a halo.
    transparent: lensEffect,
    depthWrite: !lensEffect,
    uniforms: {
      uIgnite: { value: 0 },
      uMap: { value: videoTexture },
      uVideoAspect: { value: 16 / 9 },
      uTargetAspect: { value: targetAspect },
      uLensEffect: { value: lensEffect ? 1 : 0 },
      uCoverTransmittance: { value: coverTransmittance },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      /*
       * Inverse of Three's ACES filmic tone mapping, and of the sRGB
       * transfer function — needed only for the copy of this screen that
       * ends up on the Campaigns billboard.
       *
       * The billboard is a live render of this same room
       * (campaigns/Billboard.jsx), shown on one surface whose material
       * tone-maps and encodes everything it carries — which is exactly
       * right, because every other material in the room is tone-mapped in
       * the direct view too, so the copy and the original agree. This
       * screen is the single exception: it is an unlit ShaderMaterial that
       * includes neither <tonemapping_fragment> nor
       * <colorspace_fragment>, so directly it reaches the frame buffer
       * completely untransformed. Through the billboard it did not, and the
       * video visibly changed at the hand-over: measured at the swap with
       * playback paused, every room surface matched the direct view within
       * ~5% while the screen sat 51% brighter and flatter. That is the
       * artifact long recorded in Billboard.jsx as an unexplained loss of
       * the monitor's screen content, and it is why chasing it through
       * render-target size, multisampling, mipmaps and supersampling never
       * moved it — none of those are about tone response.
       *
       * So in the render-target pass this shader writes the value that the
       * billboard's own tone map and encode will turn back into what the
       * direct view shows. Both paths then display the same pixels, and the
       * direct path is untouched — which is the point: the Digital act's
       * look is the reference here, not something to be traded away to make
       * the copy agree. Round-trips to 1e-16 across the range; white stores
       * as ~15.4, which is why the target is half-float.
       *
       * uCoverTransmittance is the one piece that is measured rather than
       * derived, and without it this correction lands in the wrong place.
       * Both callers put a glass pane in front of this screen, and that
       * pane is alpha-blended over the screen's fragment BEFORE the
       * billboard's material ever tone-maps the result — so what needs to
       * arrive at the tone map correct is the blend, not this fragment.
       * Since the value stored here is steeply convex (white lands at
       * ~15.4), being scaled by the glass afterwards throws it a long way
       * off: uncorrected, the copy still ran 23% bright, and the error grew
       * with brightness exactly as a mis-scaled inverse would. Correcting
       * for the pane's transmittance closes it to within 2%, which is
       * tighter than the room's own ~5% (that residual is the render
       * target's resolution, a separate and already-documented trade).
       * The glass's own reflection is left uncorrected — it is small, dark,
       * and cannot be separated from this fragment.
       *
       * Assumes toneMappingExposure is 1 (Three's default, and never set
       * otherwise in this project) — the 0.6 below is the exposure term
       * folded in. If the renderer's exposure ever changes, this changes
       * with it.
       */
      const mat3 ACES_IN_INV = mat3(
        vec3(1.764741, -0.147028, -0.036337),
        vec3(-0.675778, 1.160252, -0.162436),
        vec3(-0.088963, -0.013224, 1.198773)
      );
      const mat3 ACES_OUT_INV = mat3(
        vec3(0.643038, 0.059269, 0.005962),
        vec3(0.311187, 0.931436, 0.063929),
        vec3(0.045775, 0.009295, 0.930118)
      );

      // Positive root of Three's RRTAndODTFit, which is a ratio of two
      // quadratics and so inverts in closed form.
      float rrtAndOdtFitInverse(float t) {
        float a = 1.0 - 0.983729 * t;
        float b = 0.0245786 - 0.432951 * t;
        float c = -(0.000090537 + 0.238081 * t);
        return (-b + sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a);
      }

      vec3 preCompensate(vec3 displayColor) {
        // Undo the sRGB encode the billboard's material will apply...
        vec3 linear = mix(
          pow((displayColor + 0.055) / 1.055, vec3(2.4)),
          displayColor / 12.92,
          vec3(lessThanEqual(displayColor, vec3(0.04045)))
        );
        // ...then undo its tone map. Clamped just below the fit's asymptote
        // so the root stays finite for a fully saturated channel.
        vec3 fitted = min(ACES_OUT_INV * linear, vec3(0.99));
        vec3 c = vec3(
          rrtAndOdtFitInverse(fitted.r),
          rrtAndOdtFitInverse(fitted.g),
          rrtAndOdtFitInverse(fitted.b)
        );
        return max(ACES_IN_INV * c, vec3(0.0)) * 0.6;
      }

      uniform float uIgnite;
      uniform sampler2D uMap;
      uniform float uVideoAspect;
      uniform float uTargetAspect;
      uniform float uLensEffect;
      uniform float uCoverTransmittance;
      varying vec2 vUv;

      void main() {
        vec2 centered = vUv - 0.5;

        // Subtle barrel distortion — real curved glass bends light more
        // toward the rim than the center, so a flat, undistorted crop
        // reads as a flat UI panel rather than something being viewed
        // through an actual lens. Applied in UV space (before the cover
        // remap) so it bends the video content itself, not just a
        // post-hoc darkening. Strength tuned small and gated off outside
        // the lens (uLensEffect) since a rectangular screen shouldn't warp.
        vec2 distortedUv = vUv;
        if (uLensEffect > 0.5) {
          float r2 = dot(centered, centered);
          // Normalised by the corner's own strength (r2 = 0.5), so the
          // square's corners land exactly on its edge of the video and no
          // part of it samples past the frame.
          distortedUv = 0.5 + centered * (1.0 + 0.12 * r2) / (1.0 + 0.12 * 0.5);
        }

        // Standard "cover" remap: scale whichever axis needs it so the
        // video fills the full 0-1 UV square with no letterboxing,
        // cropping the excess on the other axis instead of stretching.
        vec2 ratio = vec2(
          min(uTargetAspect / uVideoAspect, 1.0),
          min(uVideoAspect / uTargetAspect, 1.0)
        );
        vec2 coverUv = vec2(
          distortedUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
          distortedUv.y * ratio.y + (1.0 - ratio.y) * 0.5
        );
        vec3 videoColor = texture2D(uMap, coverUv).rgb;

        // Same dormant glass look as the Phase 1D test pattern: near-black
        // with a faint scanline groove, so the screen still reads as a
        // physical surface (not a void) before it's ignited.
        vec3 dormantColor = vec3(0.018, 0.02, 0.024);
        dormantColor *= 0.985 + 0.015 * sin(vUv.y * 420.0);

        vec3 color = mix(dormantColor, videoColor, uIgnite);

        // Edge fade for the square preview, in coverage rather than colour,
        // so the edges reveal the live scene instead of turning black. Each
        // axis fades on its own and the two multiply: the fade follows the
        // four straight edges and keeps the square footprint, where a radial
        // one would round it off. The centre stays fully opaque, and
        // smoothstep's zero slope at both ends leaves no line where the fade
        // begins and no cut where it reaches zero at the edge.
        float alpha = 1.0;
        if (uLensEffect > 0.5) {
          vec2 edge = 1.0 - smoothstep(vec2(0.42), vec2(0.5), abs(centered));
          alpha = edge.x * edge.y;
        }

        // Three defines TONE_MAPPING only when this material is being drawn
        // to the canvas, never into a render target — so this branch is the
        // direct view, unchanged, and the other is the billboard's copy.
        #ifdef TONE_MAPPING
          gl_FragColor = vec4(color, alpha);
        #else
          // Compensated for the cover in front of this screen, without
          // which the correction lands in the wrong place — see
          // uCoverTransmittance.
          gl_FragColor = vec4(preCompensate(color * uCoverTransmittance) / uCoverTransmittance, alpha);
        #endif
      }
    `,
  })
}
