import { useMemo } from 'react'
import * as THREE from 'three'
import { sampleCameraPath } from '../timeline/cameraPath.js'
import { RIVER_CURVE, RIVER_HALF_WIDTH, RIVER_WATER_Y } from './landscape.js'
import { useExteriorLayer } from './layers.js'
import { FOG_DENSITY } from './exteriorAtmosphere.js'
import { useSkyLighting } from './skyLighting.js'

/**
 * A river across the landscape, and the daylight sky caught on it.
 *
 * The reflection is placed, not simulated — no second render pass, no
 * reflection camera. The surface tone IS the sky reflection, and it runs the
 * physically right way round: water reflects far more at grazing angles than
 * at steep ones, so the distant reach takes the sky's own horizon colour while
 * the near water, seen from above, stays a dark blue-green.
 *
 * The water opts out of the scene fog and bakes the same falloff into its
 * vertex colours instead, at the same density and toward the same horizon
 * colour, so it recedes exactly as the ground around it does while staying a
 * single unlit draw call.
 */

const WATER_NEAR_COLOR = new THREE.Color('#1d2f36')

const revealPosition = new THREE.Vector3().fromArray(sampleCameraPath(1).position)

function buildWater(horizonColor) {
  const positions = []
  const colors = []
  const indices = []
  const segments = 150
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const side = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const color = new THREE.Color()

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    RIVER_CURVE.getPoint(t, point)
    RIVER_CURVE.getTangent(t, tangent)
    side.crossVectors(tangent, up).normalize()
    for (const sign of [-1, 1]) {
      const x = point.x + side.x * RIVER_HALF_WIDTH * sign
      const z = point.z + side.z * RIVER_HALF_WIDTH * sign
      positions.push(x, RIVER_WATER_Y, z)
      const distance = Math.hypot(x - revealPosition.x, z - revealPosition.z)
      // Three's FogExp2 factor, so the water fades exactly as fogged ground does.
      const fade = Math.exp(-Math.pow(FOG_DENSITY * distance, 2))
      color.copy(horizonColor).lerp(WATER_NEAR_COLOR, fade)
      colors.push(color.r, color.g, color.b)
    }
    if (i < segments) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  return geometry
}

export default function River() {
  const applyExteriorLayer = useExteriorLayer()
  const { horizonColor } = useSkyLighting()
  const waterGeometry = useMemo(() => buildWater(horizonColor), [horizonColor])

  return (
    <group ref={applyExteriorLayer}>
      <mesh geometry={waterGeometry} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} fog={false} />
      </mesh>
    </group>
  )
}
