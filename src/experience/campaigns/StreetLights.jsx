import { useMemo } from 'react'
import * as THREE from 'three'
import { sampleCameraPath } from '../timeline/cameraPath.js'
import { centrelinePoint, groundY } from './highway.js'
import { useExteriorLayer } from './layers.js'
import { MODEL_URLS, cloneNode, measure, useModel } from '../models/modelAssets.js'

/**
 * Lighting columns down the median, running away into the distance.
 *
 * Entirely static — the poles never move, so unlike the traffic there is no
 * per-frame work at all here: the positions are baked once into two
 * `InstancedMesh` transforms and one `Points` buffer, and after that the
 * whole run costs three draw calls and nothing else.
 *
 * Scale is set against the traffic rather than against the frame: a 9-unit
 * column over vehicles that stand 1.5 to 3.5 puts the lamps at roughly
 * three times a car's height, which is what a motorway column actually
 * looks like. Spacing likewise — 30 units against 3.5-unit lanes is real
 * motorway spacing, not a density chosen to fill the shot.
 */

const POLE_SPACING = 30
const POLE_HEIGHT = 9
const POLE_RADIUS = 0.13
const ARM_REACH = 1.5

// The run starts just past the camera and continues well beyond the drawn
// ribbon. Everything past ~90 units is heavily fogged, so what is actually
// being extended is the chain of lamp glows — the poles under them have
// long since dissolved, which is exactly what a real lit road looks like
// from a distance.
const FIRST_S = 45
const LAST_S = -195

// The glows opt out of the scene fog (like the vehicles' lamps, and for the
// same reason — at these distances it would erase them outright) and carry
// their own, gentler falloff instead, baked per lamp from the camera's
// resting pose. Without it the chain would stay pin-bright to the horizon
// and read as a string of beads rather than as a road going away.
const GLOW_FALLOFF = 0.011
const GLOW_COLOR = new THREE.Color('#ffcf95')
const GLOW_SIZE = 2.1

// Faint pool of light under each column. Subtle by construction: without
// something on the road the lamps read as dots hanging in the dark, but a
// pool bright enough to notice on its own would out-light the billboard,
// which is meant to be the lit object in this world.
const POOL_RADIUS = 7
const POOL_OPACITY = 0.09

const revealPosition = new THREE.Vector3().fromArray(sampleCameraPath(1).position)

function poolTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,225,185,0.85)')
  gradient.addColorStop(0.45, 'rgba(255,215,170,0.25)')
  gradient.addColorStop(1, 'rgba(255,205,155,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function glowTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.22, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.28)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildRun() {
  const columns = []
  const point = new THREE.Vector3()
  const ahead = new THREE.Vector3()
  for (let s = FIRST_S; s >= LAST_S; s -= POLE_SPACING) {
    centrelinePoint(s, point)
    // Face each column along the road, so its arm reaches across the
    // carriageway rather than at an arbitrary angle to it.
    centrelinePoint(s - 1, ahead)
    columns.push({
      x: point.x,
      z: point.z,
      yaw: Math.atan2(ahead.x - point.x, ahead.z - point.z),
      distance: Math.hypot(point.x - revealPosition.x, point.z - revealPosition.z),
    })
  }
  return columns
}

/**
 * One lamp column from `street-lights.glb`.
 *
 * The file is a row of eight lamps; this takes a single one and instances
 * it, so the run down the median costs one draw call however many columns
 * it has — the same trade the procedural cylinder made.
 *
 * Scaled by height rather than by arm span. Both were tried: at this
 * distance the column's height against the traffic beside it is what sets
 * the sense of scale, while the arm span is barely readable, so height is
 * the measurement worth matching to `POLE_HEIGHT`. The model is a
 * double-arm design, which is why the glows below moved from one per
 * column to one per arm — see `buildRun`'s callers.
 */
const MODEL_COLUMN_NODES = ['polySurface109_metal_0', 'polySurface109_light_0']

function useLampColumn() {
  const gltf = useModel(MODEL_URLS.streetLights)

  return useMemo(() => {
    const holder = new THREE.Group()
    const parts = MODEL_COLUMN_NODES.map((name) => cloneNode(gltf, name)).filter(Boolean)
    if (!parts.length) return null
    holder.add(...parts)

    const authored = measure(holder)
    holder.scale.setScalar(POLE_HEIGHT / authored.size.y)

    const scaled = measure(holder)
    // Stand it on the road surface and centre it on its own column, so a
    // plain position/yaw places it exactly as the cylinder was placed.
    holder.position.x -= scaled.center.x
    holder.position.z -= scaled.center.z
    holder.position.y -= scaled.box.min.y

    holder.updateWorldMatrix(true, true)
    const geometries = []
    const materials = []
    holder.traverse((object) => {
      if (!object.isMesh) return
      const geometry = object.geometry.clone()
      geometry.applyMatrix4(object.matrixWorld)
      geometries.push(geometry)
      materials.push(object.material)
    })

    const final = measure(holder)
    return { geometries, materials, armReach: final.size.z / 2, headHeight: final.box.max.y }
  }, [gltf])
}

export default function StreetLights() {
  const applyExteriorLayer = useExteriorLayer()
  const columns = useMemo(buildRun, [])
  const lamp = useLampColumn()
  const glowMap = useMemo(glowTexture, [])
  const poolMap = useMemo(poolTexture, [])

  const { poleMatrices, poolMatrices, glowPositions, glowColors } = useMemo(() => {
    // Two lamps per column now, not one: the model is a double-arm design
    // reaching across both carriageways, so a single glow at a guessed
    // offset would have sat in mid-air beside the heads rather than under
    // them. Reach and height come from the fitted model, not a constant.
    const reach = lamp ? lamp.armReach * 0.72 : ARM_REACH
    const headY = lamp ? lamp.headHeight - 0.35 : POLE_HEIGHT - 0.12
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
    const color = new THREE.Color()

    const poles = []
    const pools = []
    const glowPositions = new Float32Array(columns.length * 2 * 3)
    const glowColors = new Float32Array(columns.length * 2 * 3)

    columns.forEach((column, i) => {
      quaternion.setFromAxisAngle(up, column.yaw)

      // The column itself sits ON the road surface — the model was fitted
      // with its base at zero, so no half-height offset is needed the way
      // the centred cylinder required one.
      position.set(column.x, groundY, column.z)
      scale.set(1, 1, 1)
      poles.push(matrix.compose(position, quaternion, scale).clone())

      const fade = Math.exp(-Math.pow(GLOW_FALLOFF * column.distance, 2))
      color.copy(GLOW_COLOR).multiplyScalar(0.35 + fade * 0.65)

      for (let side = 0; side < 2; side += 1) {
        const offset = side === 0 ? reach : -reach
        // The arms run across the column's own axis, so the offset is
        // taken along the yaw's perpendicular.
        const armX = column.x + Math.cos(column.yaw) * offset
        const armZ = column.z - Math.sin(column.yaw) * offset
        const slot = i * 2 + side

        position.set(armX, groundY + 0.03, armZ)
        pools.push(matrix.compose(position, flat, scale).clone())

        glowPositions[slot * 3] = armX
        glowPositions[slot * 3 + 1] = groundY + headY
        glowPositions[slot * 3 + 2] = armZ
        glowColors[slot * 3] = color.r
        glowColors[slot * 3 + 1] = color.g
        glowColors[slot * 3 + 2] = color.b
      }
    })

    return { poleMatrices: poles, poolMatrices: pools, glowPositions, glowColors }
  }, [columns, lamp])

  const applyMatrices = (matrices) => (mesh) => {
    if (!mesh) return
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    mesh.instanceMatrix.needsUpdate = true
  }

  return (
    <group ref={applyExteriorLayer}>
      {/* Columns and lamp heads. Fogged like the rest of the road furniture,
          so they dissolve with distance and leave only the glows — which is
          how a lit road actually reads from far off. */}
      {lamp?.geometries.map((geometry, index) => (
        <instancedMesh
          key={index}
          ref={applyMatrices(poleMatrices)}
          args={[geometry, undefined, columns.length]}
          frustumCulled={false}
        >
          <meshStandardMaterial color="#15161a" roughness={0.8} metalness={0.4} />
        </instancedMesh>
      ))}

      <instancedMesh ref={applyMatrices(poolMatrices)} args={[undefined, undefined, columns.length * 2]} frustumCulled={false}>
        <circleGeometry args={[POOL_RADIUS, 20]} />
        <meshBasicMaterial
          map={poolMap}
          color={GLOW_COLOR}
          transparent
          opacity={POOL_OPACITY}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[glowPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[glowColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={glowMap}
          size={GLOW_SIZE}
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
