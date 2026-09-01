import * as THREE from 'three'

/**
 * The Phase 2 Digital screen material — samples a `THREE.VideoTexture`
 * instead of the Phase 1D procedural test pattern, but keeps the exact
 * same dormant/ignite behavior: an unlit `ShaderMaterial` (`toneMapped:
 * false`) blending between a near-black dormant glass look and the live
 * video frame via `uIgnite`, driven by `Monitor.jsx`'s existing
 * onCameraLock/onCameraUnlock damping — untouched by this swap.
 */
export function createScreenVideoMaterial(videoTexture) {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uIgnite: { value: 0 },
      uMap: { value: videoTexture },
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
      varying vec2 vUv;

      void main() {
        vec3 videoColor = texture2D(uMap, vUv).rgb;

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
