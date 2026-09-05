import { useMemo } from 'react'
import * as THREE from 'three'
import { lightingParams } from '../lighting/volumetricLighting.js'
import { sampleCameraPath } from '../timeline/cameraPath.js'
import { RIVER_CURVE, RIVER_HALF_WIDTH, RIVER_WATER_Y } from './landscape.js'
import { useExteriorLayer } from './layers.js'

/**
 * A river across the desert, and the night sky caught on it.
 *
 * The reflections are placed, not simulated — no second render pass, no
 * reflection camera. Two things carry them.
 *
 * The surface tone IS the sky reflection, and it runs the physically right
 * way round: water reflects far more at grazing angles than at steep ones,
 * so the distant reach picks up the horizon's own colour while the near
 * water, seen from above, stays near-black. That gradient alone is most of
 * what makes it read as water rather than as a dark ribbon.
 *
 * The stars are then scattered across it, dimmed hard — a few percent, which
 * is roughly what water returns at these angles. Anything brighter reads as
 * lights under the surface instead of sky on top of it.
 *
 * There is deliberately no moon glitter. The reflection of a source is
 * fixed by geometry — mirror it through the plane and see where the line
 * from the eye crosses — and with the moon composed to the right of frame
 * and the water lying to the left, no such crossing lands on this river.
 * Faking a glitter path where the moon cannot put one would be the kind of
 * detail that looks convincing until someone traces it.
 *
 * Like the ridges and the lamps, the water opts out of the scene fog and
 * carries its own gentler falloff baked into vertex colours. At the 30-80
 * units this occupies, the real fog is 80-99% saturated and would have left
 * a flat grey band where the river should be.
 */

const FOG_COLOR = new THREE.Color(lightingParams.fog.color)
const WATER_NEAR_COLOR = new THREE.Color('#0b1522')
const WATER_FALLOFF = 0.008

const STAR_REFLECTION_COUNT = 70

const revealPosition = new THREE.Vector3().fromArray(sampleCameraPath(1).position)

function gradientTexture(stops, width = 64, height = 64) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2)
  stops.forEach(([at, alpha]) => gradient.addColorStop(at, `rgba(255,255,255,${alpha})`))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildWater() {
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
      const fade = Math.exp(-Math.pow(WATER_FALLOFF * distance, 2))
      color.copy(FOG_COLOR).lerp(WATER_NEAR_COLOR, fade)
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

function buildStarReflections() {
  let seed = 4471
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const positions = new Float32Array(STAR_REFLECTION_COUNT * 3)
  const colors = new Float32Array(STAR_REFLECTION_COUNT * 3)
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const side = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const color = new THREE.Color()

  for (let i = 0; i < STAR_REFLECTION_COUNT; i += 1) {
    const t = random()
    RIVER_CURVE.getPoint(t, point)
    RIVER_CURVE.getTangent(t, tangent)
    side.crossVectors(tangent, up).normalize()
    const across = (random() - 0.5) * 2 * RIVER_HALF_WIDTH * 0.9
    const x = point.x + side.x * across
    const z = point.z + side.z * across
    positions[i * 3] = x
    positions[i * 3 + 1] = RIVER_WATER_Y + 0.02
    positions[i * 3 + 2] = z

    // Dimmer and cooler than the stars themselves — water reflects only a
    // few percent at these grazing angles, and anything brighter reads as
    // lights under the surface rather than sky on top of it.
    const distance = Math.hypot(x - revealPosition.x, z - revealPosition.z)
    const fade = Math.exp(-Math.pow(WATER_FALLOFF * distance, 2))
    const brightness = (0.16 + Math.pow(random(), 2.2) * 0.78) * fade
    color.setHSL(0.57, 0.22, 0.5).multiplyScalar(brightness)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  return { positions, colors }
}

export default function River() {
  const applyExteriorLayer = useExteriorLayer()
  const waterGeometry = useMemo(buildWater, [])
  const starReflections = useMemo(buildStarReflections, [])
  const starTexture = useMemo(() => gradientTexture([[0, 1], [0.4, 0.4], [1, 0]]), [])

  return (
    <group ref={applyExteriorLayer}>
      <mesh geometry={waterGeometry} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} fog={false} />
      </mesh>

      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starReflections.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[starReflections.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={starTexture}
          size={1.5}
          vertexColors
          transparent
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  )
}
