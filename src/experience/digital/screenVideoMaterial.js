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
 */
export function createScreenVideoMaterial(videoTexture, targetAspect = 1) {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uIgnite: { value: 0 },
      uMap: { value: videoTexture },
      uVideoAspect: { value: 16 / 9 },
      uTargetAspect: { value: targetAspect },
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
      varying vec2 vUv;

      void main() {
        // Standard "cover" remap: scale whichever axis needs it so the
        // video fills the full 0-1 UV square with no letterboxing,
        // cropping the excess on the other axis instead of stretching.
        vec2 ratio = vec2(
          min(uTargetAspect / uVideoAspect, 1.0),
          min(uVideoAspect / uTargetAspect, 1.0)
        );
        vec2 coverUv = vec2(
          vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
          vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
        );
        vec3 videoColor = texture2D(uMap, coverUv).rgb;

        // Same dormant glass look as the Phase 1D test pattern: near-black
        // with a faint scanline groove, so the screen still reads as a
        // physical surface (not a void) before it's ignited.
        vec3 dormantColor = vec3(0.018, 0.02, 0.024);
        dormantColor *= 0.985 + 0.015 * sin(vUv.y * 420.0);

        vec3 color = mix(dormantColor, videoColor, uIgnite);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
}
