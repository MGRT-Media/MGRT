import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { LIGHTS } from './studioLayout.js'
import { lightLevels } from './StudioLightingRig.jsx'
import { LOOK } from './studioLook.js'

const SPOTS = ['lettering', 'tableKey']

/** A spot's position, aim, cone and colour, as the shader needs them. */
function spotUniforms(name) {
  const { position, target, color, angleDegrees, penumbra, intensity } = LIGHTS[name]
  const from = new THREE.Vector3().fromArray(position)
  const outer = THREE.MathUtils.degToRad(angleDegrees)
  return {
    position: from,
    direction: new THREE.Vector3().fromArray(target).sub(from).normalize(),
    // Cosines of the cone's edge and of where its soft edge begins.
    cone: new THREE.Vector2(Math.cos(outer), Math.cos(outer * (1 - penumbra))),
    // Relative strength, so the brighter fixture lights its dust more.
    color: new THREE.Color(color).multiplyScalar(intensity / LIGHTS.tableKey.intensity),
  }
}

/**
 * Dust in the light: a few hundred motes drifting in the air over the table
 * and up the wall, visible only where one of the two spots catches them.
 *
 * Each mote works out for itself whether it is inside a beam, from the same
 * fixture definitions the real lights are built from, and takes that light's
 * colour and current level. In the dark it is not drawn at all. So the dust
 * needs no lighting of its own to keep in step: it gives the beams a little
 * depth and otherwise is not there.
 *
 * One draw call, animated in the vertex shader; nothing is updated per mote.
 */
export default function StudioDust() {
  const { geometry, material } = useMemo(() => {
    const { count, size, brightness, volume } = LOOK.dust
    const [min, max] = volume
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        positions[i * 3 + axis] = THREE.MathUtils.lerp(min[axis], max[axis], Math.random())
        seeds[i * 3 + axis] = Math.random()
      }
    }
    const points = new THREE.BufferGeometry()
    points.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    points.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))

    const spots = SPOTS.map(spotUniforms)
    const shader = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size },
        uBrightness: { value: brightness },
        uScale: { value: 1 },
        uSpotPosition: { value: spots.map((spot) => spot.position) },
        uSpotDirection: { value: spots.map((spot) => spot.direction) },
        uSpotCone: { value: spots.map((spot) => spot.cone) },
        uSpotColor: { value: spots.map((spot) => spot.color) },
        uSpotLevel: { value: [0, 0] },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uSize;
        uniform float uScale;
        uniform vec3 uSpotPosition[2];
        uniform vec3 uSpotDirection[2];
        uniform vec2 uSpotCone[2];
        uniform vec3 uSpotColor[2];
        uniform float uSpotLevel[2];
        varying vec3 vLight;

        void main() {
          // A slow wander around each mote's own place, and a slower settle.
          vec3 drift = vec3(
            sin( uTime * ( 0.05 + aSeed.x * 0.06 ) + aSeed.y * 6.2831 ),
            sin( uTime * ( 0.04 + aSeed.y * 0.05 ) + aSeed.z * 6.2831 ) * 0.6,
            cos( uTime * ( 0.05 + aSeed.z * 0.06 ) + aSeed.x * 6.2831 )
          ) * 0.16;
          vec3 world = position + drift;

          vLight = vec3( 0.0 );
          for ( int i = 0; i < 2; i++ ) {
            vec3 toMote = world - uSpotPosition[i];
            float along = dot( normalize( toMote ), uSpotDirection[i] );
            float inside = smoothstep( uSpotCone[i].x, uSpotCone[i].y, along );
            float distance = length( toMote );
            vLight += uSpotColor[i] * uSpotLevel[i] * inside / ( 1.0 + distance * distance * 0.12 );
          }

          vec4 view = viewMatrix * vec4( world, 1.0 );
          gl_Position = projectionMatrix * view;
          // Unlit motes are given no size, so they cost no fill.
          float lit = step( 0.002, max( vLight.r, max( vLight.g, vLight.b ) ) );
          gl_PointSize = lit * uSize * ( 0.6 + aSeed.x * 0.8 ) * uScale / -view.z;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uBrightness;
        varying vec3 vLight;

        void main() {
          float fromCentre = length( gl_PointCoord - 0.5 ) * 2.0;
          float soft = smoothstep( 1.0, 0.0, fromCentre );
          gl_FragColor = vec4( vLight * uBrightness * soft * soft, 1.0 );
        }
      `,
    })
    return { geometry: points, material: shader }
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(({ clock, size, camera, viewport }) => {
    const uniforms = material.uniforms
    uniforms.uTime.value = clock.elapsedTime
    // Pixels per metre at one metre, so a mote's size is in metres.
    uniforms.uScale.value = (size.height * viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
    SPOTS.forEach((name, index) => {
      uniforms.uSpotLevel.value[index] = lightLevels[name]
    })
  })

  // Never culled: the motes move in the shader, away from the bounds here.
  return <points geometry={geometry} material={material} frustumCulled={false} />
}
