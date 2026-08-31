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
 * post-processing bloom — but only once it's actually ignited.
 *
 * `uIgnite` (0–1, default 0) blends between a dark, dormant CRT-glass look
 * (near-black with a faint scanline groove for surface depth — the screen
 * still reads as a physical object, not a void) and the full color-bar
 * pattern. Zero emissive output at `uIgnite = 0`, per explicit request —
 * the pattern content itself is unchanged, just gated behind this uniform
 * rather than always rendered at full brightness. Set from
 * `Monitor.jsx`'s own `useFrame`, damped toward a target driven by
 * `cameraLockEvent.js`'s `onCameraLock`/`onCameraUnlock` — not React
 * state, per technical-architecture.md §7.
 *
 * The screen's own "catching ambient highlights from the breach" is
 * intentionally NOT built into this unlit shader — that's already the
 * separate glass pane's job (`Monitor.jsx`, a real `MeshPhysicalMaterial`
 * that responds to actual scene lights), sitting just in front of this
 * plane. Duplicating lit-material behavior into an unlit shader here
 * would be redundant complexity for the same visual result.
 */
export function createScreenTestPatternMaterial() {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uIgnite: { value: 0 },
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
      varying vec2 vUv;

      void main() {
        float bar = floor(vUv.x * 8.0);
        vec3 patternColor;
        if (bar < 1.0) patternColor = vec3(0.85);
        else if (bar < 2.0) patternColor = vec3(0.85, 0.85, 0.0);
        else if (bar < 3.0) patternColor = vec3(0.0, 0.85, 0.85);
        else if (bar < 4.0) patternColor = vec3(0.0, 0.85, 0.0);
        else if (bar < 5.0) patternColor = vec3(0.85, 0.0, 0.85);
        else if (bar < 6.0) patternColor = vec3(0.85, 0.0, 0.0);
        else if (bar < 7.0) patternColor = vec3(0.0, 0.0, 0.85);
        else patternColor = vec3(0.05);

        // Faint scanlines — a restrained hint of screen texture, not a CRT effect.
        patternColor *= 0.95 + 0.05 * sin(vUv.y * 420.0);

        // Soft vignette so the screen reads as a lit surface, not a flat card.
        float d = distance(vUv, vec2(0.5));
        patternColor *= 1.0 - smoothstep(0.45, 0.72, d) * 0.35;

        // Dormant glass look: near-black with the same scanline frequency
        // (very low contrast) so the surface still shows a hint of
        // structure/depth even powered off, rather than reading as a flat
        // void or a hole in the housing.
        vec3 dormantColor = vec3(0.018, 0.02, 0.024);
        dormantColor *= 0.985 + 0.015 * sin(vUv.y * 420.0);

        vec3 color = mix(dormantColor, patternColor, uIgnite);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
}
