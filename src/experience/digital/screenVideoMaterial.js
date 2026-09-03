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
 * `lensEffect` (default off) adds two optical touches per explicit
 * request that the Cinema Camera's lens preview "feel like a real
 * cinema camera lens... not a hard geometric shape": a subtle radial
 * barrel distortion (the image bends very slightly toward the rim,
 * exactly like light bending through real curved glass) and a soft
 * vignette (brightness eases down approaching the edge instead of
 * cutting off abruptly). Both only make sense for a genuinely circular
 * view onto glass — `Monitor.jsx`'s flat rectangular screen keeps this
 * off, the default, so its own `<video>` texture is untouched by either
 * effect. Deliberately a uniform toggle rather than two separate shader
 * variants: the only thing that differs between callers is ON/OFF, not
 * the tuning, so a single shared shader with a branch is simpler than
 * maintaining two.
 */
export function createScreenVideoMaterial(videoTexture, targetAspect = 1, { lensEffect = false } = {}) {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uIgnite: { value: 0 },
      uMap: { value: videoTexture },
      uVideoAspect: { value: 16 / 9 },
      uTargetAspect: { value: targetAspect },
      uLensEffect: { value: lensEffect ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIgnite;
      uniform sampler2D uMap;
      uniform float uVideoAspect;
      uniform float uTargetAspect;
      uniform float uLensEffect;
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
          distortedUv = 0.5 + centered * (1.0 + 0.12 * r2);
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

        // Soft vignette: the circular geometry itself already clips the
        // mesh to a perfect disc (no fragments exist past its edge), but
        // a perfectly sharp bright-to-nothing cutoff still reads as a
        // mathematical mask, not an optical falloff — real lenses dim
        // gradually toward the rim. Fading brightness out just before
        // that geometric edge (0.32 -> 0.5, in the same 0-0.5
        // center-to-rim UV space the distortion above uses) gives the
        // transition a soft, photographic edge instead of a hard one.
        if (uLensEffect > 0.5) {
          float vignette = 1.0 - smoothstep(0.32, 0.5, length(centered));
          color *= vignette;
        }

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
}
