import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useLoader, useThree } from '@react-three/fiber'
import { sampleCameraPath } from '../timeline/cameraPath.js'
import { useExteriorLayer } from './layers.js'
import {
  SKY_BACKDROP_SCALE,
  SKY_BACKDROP_URL,
  SKY_INTENSITY,
  SKY_ROTATION_Y,
  exteriorAtmosphere,
} from './exteriorAtmosphere.js'
import { useSkyLighting } from './skyLighting.js'

/**
 * The Campaigns sky: the supplied photograph, as the backdrop and as the light.
 *
 * Drawn on a dome rather than through `scene.background` for the same reason
 * the room's `SunsetSky` is: a mesh sits on a layer, the scene background does
 * not, and the two skies must never both be visible. This dome is on the
 * exterior layer, so it exists exactly when the exterior does.
 */

const SKY_RADIUS = 360
const revealPosition = new THREE.Vector3().fromArray(sampleCameraPath(1).position)

export default function DaySky() {
  const applyExteriorLayer = useExteriorLayer()
  const gl = useThree((state) => state.gl)
  const backdrop = useLoader(THREE.TextureLoader, SKY_BACKDROP_URL)
  const { hdr, horizonColor } = useSkyLighting()

  useMemo(() => {
    backdrop.colorSpace = THREE.SRGBColorSpace
    // Wraps around the dome horizontally; clamped at the poles.
    backdrop.wrapS = THREE.RepeatWrapping
    backdrop.wrapT = THREE.ClampToEdgeWrapping
    // No mipmaps: the panorama's u jumps from 1 back to 0 where it wraps, and
    // mip selection reads that jump as extreme minification, drawing a thin
    // line down the sky. At 2048 wide the sky is never minified far enough
    // to need them.
    backdrop.generateMipmaps = false
    backdrop.minFilter = THREE.LinearFilter
    backdrop.needsUpdate = true
    gl.initTexture(backdrop)
  }, [backdrop, gl])

  // The PMREM environment, built once on the held Digital frame this mounts on.
  const environment = useMemo(() => {
    hdr.mapping = THREE.EquirectangularReflectionMapping
    const generator = new THREE.PMREMGenerator(gl)
    const target = generator.fromEquirectangular(hdr)
    generator.dispose()
    return target
  }, [hdr, gl])

  useEffect(() => {
    exteriorAtmosphere.environment = environment.texture
    exteriorAtmosphere.fogColor.copy(horizonColor)
    return () => {
      if (exteriorAtmosphere.environment === environment.texture) exteriorAtmosphere.environment = null
      environment.dispose()
    }
  }, [environment, horizonColor])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uSky: { value: backdrop },
          uRotation: { value: SKY_ROTATION_Y },
          uScale: { value: SKY_BACKDROP_SCALE * SKY_INTENSITY },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDirection;
          void main() {
            vDirection = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        // Linear HDR out, like every other material here: the composer's
        // OutputPass tone-maps once at the end. The backdrop texture is sRGB,
        // so the GPU decodes it to linear on sampling; the scale undoes the
        // 1/6 it was stored at and applies the exposure balance.
        fragmentShader: /* glsl */ `
          uniform sampler2D uSky;
          uniform float uRotation;
          uniform float uScale;
          varying vec3 vDirection;

          #define RECIPROCAL_PI 0.3183098861837907
          #define RECIPROCAL_PI2 0.15915494309189535

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
            gl_FragColor = vec4(texture2D(uSky, equirectUv(rotateY(d, uRotation))).rgb * uScale, 1.0);
          }
        `,
      }),
    [backdrop],
  )
  const geometry = useMemo(() => new THREE.SphereGeometry(SKY_RADIUS, 48, 24), [])

  return (
    <group ref={applyExteriorLayer}>
      <mesh
        geometry={geometry}
        material={material}
        position={revealPosition}
        renderOrder={-1}
        frustumCulled={false}
      />
    </group>
  )
}
