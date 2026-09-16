import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { sunDirection } from './volumetricLighting.js'
import { loadSkyTexture, registerSkyUpgrade, SKY_ROTATION_Y } from './skyEnvironment.js'

/**
 * The sky the roof opening looks out on.
 *
 * Until this existed the court was a hole onto nothing: `scene.background` is
 * null, so every direction the room did not cover resolved to the canvas's own
 * clear colour and the opening read as a black void punched in the ceiling.
 * The silhouette was doing all the work and the contrast ran the wrong way —
 * the brightest thing in the frame was the stone, and the source of the light
 * was the darkest. That is the one thing an opening to the daytime sky cannot
 * look like.
 *
 * **Where the bright part of the sky sits is not decoration.** The glow is
 * built around `sunDirection()` — the same vector the DirectionalLight uses —
 * so the blaze in the aperture is in the direction the shaft actually comes
 * from. Aim them independently and the eye catches it immediately: light
 * arriving from one bearing while the sky burns at another reads as two
 * unrelated effects rather than one sun.
 *
 * **What you actually see is the HDRI**, sampled as an equirectangular map on
 * this same dome rather than through `scene.background`. Three's background
 * would render the photograph correctly with less code, but it is a property
 * of the scene, not of an object: a mesh can be culled, layered, and ordered
 * like everything else in the room, where a background cannot.
 *
 * The gradient below is not dead code: it is what the aperture shows until the
 * HDRI finishes downloading, and what it falls back to permanently if the file
 * never arrives. Blended by `uSkyMix` rather than swapped, so the upgrade is a
 * single frame's change of a uniform rather than a rebuild.
 */

/**
 * Comfortably outside the room and comfortably inside the interior camera's
 * `far` of 100 — the camera never leaves the building.
 */
const SKY_RADIUS = 70

/**
 * Colours are LINEAR and deliberately above 1.
 *
 * The composer renders to a HalfFloat target and `OutputPass` applies tone
 * mapping at the end, so materials here output raw linear HDR — three skips
 * per-material tone mapping whenever the destination is a render target rather
 * than the canvas. Values over 1 are the point: ACES rolls them toward white,
 * which is what makes the aperture read as blown-out daylight instead of a
 * flat orange disc.
 */
const HORIZON = new THREE.Color(2.4, 1.15, 0.5)
const ZENITH = new THREE.Color(0.55, 0.52, 0.78)
const GLOW = new THREE.Color(2.9, 1.5, 0.65)
const DISC = new THREE.Color(16, 11, 6.5)

export default function SunsetSky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        // A skybox in all but name: drawn first, never occluding anything, and
        // never writing depth so the room in front of it always wins.
        depthWrite: false,
        fog: false,
        uniforms: {
          uSun: { value: sunDirection() },
          uHorizon: { value: HORIZON },
          uZenith: { value: ZENITH },
          uGlow: { value: GLOW },
          uDisc: { value: DISC },
          uSky: { value: null },
          /** 0 = procedural gradient, 1 = the photograph. */
          uSkyMix: { value: 0 },
          uSkyRotation: { value: SKY_ROTATION_Y },
          /**
           * 1.0 -> 0.35, and this is a tone-curve correction rather than a
           * taste one.
           *
           * The sky was reading as flat white, and the HDRI was not the
           * problem: measured off the file, the band this aperture actually
           * shows is a proper blue in linear space — (0.53, 0.74, 1.01) at 60
           * degrees of elevation. What flattened it is where those numbers
           * land on the curve. Three's ACES fit begins with
           * `color *= toneMappingExposure / 0.6`, so at exposure 1.0 every
           * value is multiplied by 1.667 BEFORE the curve is applied. That put
           * the visible sky between 0.5 and 2.2, which is the shoulder: all
           * three channels compress toward 1.0 together, so luminance survives
           * and hue does not. Measured output was (212, 222, 230) — 8%
           * saturation. White.
           *
           * Scaling here rather than at the renderer is the whole point.
           * Global exposure would fix the sky by darkening the room with it;
           * this moves only the dome down onto the linear part of the curve,
           * where blue is still blue. At 0.35 the same band renders
           * (100, 131, 160) at the top of the aperture through
           * (185, 194, 200) at the bottom — 38% saturation, a real gradient
           * across the opening, and nothing clipped. The room's own exposure is
           * untouched.
           *
           * The environment term is graded separately by `SceneEnvironment`'s
           * own intensity, so the two were never tied together anyway.
           */
          uSkyIntensity: { value: 0.35 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDirection;
          void main() {
            vDirection = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun;
          uniform vec3 uHorizon;
          uniform vec3 uZenith;
          uniform vec3 uGlow;
          uniform vec3 uDisc;
          uniform sampler2D uSky;
          uniform float uSkyMix;
          uniform float uSkyRotation;
          uniform float uSkyIntensity;
          varying vec3 vDirection;

          #define RECIPROCAL_PI 0.3183098861837907
          #define RECIPROCAL_PI2 0.15915494309189535

          // Three's own equirectangular convention, matched exactly so the
          // dome and the PMREM environment derived from the same file agree.
          vec2 equirectUv(vec3 dir) {
            return vec2(
              atan(dir.z, dir.x) * RECIPROCAL_PI2 + 0.5,
              asin(clamp(dir.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5
            );
          }

          vec3 rotateY(vec3 d, float a) {
            float c = cos(a);
            float s = sin(a);
            return vec3(d.x * c + d.z * s, d.y, -d.x * s + d.z * c);
          }

          void main() {
            vec3 d = normalize(vDirection);

            if (uSkyMix > 0.999) {
              gl_FragColor = vec4(
                texture2D(uSky, equirectUv(rotateY(d, uSkyRotation))).rgb * uSkyIntensity,
                1.0
              );
              return;
            }

            // Vertical gradient. The exponent is below 1 so the warm band
            // reaches well up the dome rather than hugging a horizon this
            // room can never see — through a hole in a ceiling the visible
            // sky sits between roughly 25 and 60 degrees of elevation, so a
            // conventional horizon-weighted sky would show none of its warmth.
            float h = clamp(d.y, 0.0, 1.0);
            vec3 sky = mix(uHorizon, uZenith, pow(h, 0.75));

            float toward = max(dot(d, uSun), 0.0);
            // Broad warmth across the sun's whole half of the dome, then a
            // tighter blaze, then the disc itself. Three falloffs rather than
            // one: a single exponent either makes a hard-edged ball or a wash
            // with no centre, and a sunset has both.
            sky += uGlow * pow(toward, 1.6) * 0.40;
            sky += uGlow * pow(toward, 9.0) * 1.10;
            sky += uDisc * pow(toward, 1400.0);

            if (uSkyMix > 0.0) {
              vec3 photo = texture2D(uSky, equirectUv(rotateY(d, uSkyRotation))).rgb * uSkyIntensity;
              sky = mix(sky, photo, uSkyMix);
            }

            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    [],
  )

  const geometry = useMemo(() => new THREE.SphereGeometry(SKY_RADIUS, 32, 20), [])

  /**
   * The same exchange again when the original sky lands, and cheaper still:
   * the dome only has to point at a different texture. Nothing is prepared
   * here, so `prepare` goes straight to the commit that `upgradeSky` runs
   * alongside the environment's.
   */
  useEffect(
    () =>
      registerSkyUpgrade((texture) => () => {
        material.uniforms.uSky.value = texture
      }),
    [material],
  )

  // Upgrade in place when the photograph arrives. Two uniforms, no remount —
  // the dome that was already drawing simply starts sampling a different
  // source, so nothing in the frame moves.
  useEffect(() => {
    let cancelled = false
    loadSkyTexture()
      .then((texture) => {
        if (cancelled) return
        material.uniforms.uSky.value = texture
        material.uniforms.uSkyMix.value = 1
        material.needsUpdate = true
      })
      .catch(() => {
        // Keep the gradient. A missing file must not leave a black aperture.
      })
    return () => {
      cancelled = true
    }
  }, [material])

  return <mesh geometry={geometry} material={material} renderOrder={-1} frustumCulled={false} />
}
