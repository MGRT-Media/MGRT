import * as THREE from 'three'

/**
 * A provisional, unlit test-pattern shader for the Phase 1D monitor screen
 * — a simple SMPTE-style color-bar pattern with a faint scanline texture
 * and a soft vignette. Placeholder only; Phase 2 replaces this with actual
 * selected Digital work per experience-design.md §8.
 *
 * `toneMapped = false` lets the raw shader output bypass the scene's ACES
 * tone mapping, so the screen reads as a genuinely glowing/illuminated
 * surface against the dark room without needing a real light source or
 * post-processing bloom.
 */
export function createScreenTestPatternMaterial() {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;

      void main() {
        float bar = floor(vUv.x * 8.0);
        vec3 color;
        if (bar < 1.0) color = vec3(0.85);
        else if (bar < 2.0) color = vec3(0.85, 0.85, 0.0);
        else if (bar < 3.0) color = vec3(0.0, 0.85, 0.85);
        else if (bar < 4.0) color = vec3(0.0, 0.85, 0.0);
        else if (bar < 5.0) color = vec3(0.85, 0.0, 0.85);
        else if (bar < 6.0) color = vec3(0.85, 0.0, 0.0);
        else if (bar < 7.0) color = vec3(0.0, 0.0, 0.85);
        else color = vec3(0.05);

        // Faint scanlines — a restrained hint of screen texture, not a CRT effect.
        color *= 0.95 + 0.05 * sin(vUv.y * 420.0);

        // Soft vignette so the screen reads as a lit surface, not a flat card.
        float d = distance(vUv, vec2(0.5));
        color *= 1.0 - smoothstep(0.45, 0.72, d) * 0.35;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
}
