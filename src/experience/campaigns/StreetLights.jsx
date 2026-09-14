import { useMemo } from 'react'
import * as THREE from 'three'
import { sampleCameraPath } from '../timeline/cameraPath.js'
import { centrelinePoint, groundY } from './highway.js'
import { useExteriorLayer } from './layers.js'
import { MODEL_URLS, bakedGeometry, cloneNode, measure, useModel } from '../models/modelAssets.js'

/**
 * Lighting columns down the median, running away into the distance.
 *
 * Entirely static — there is no per-frame work at all here: the positions
 * are baked once into the column instances, the pools and one `Points`
 * buffer.
 *
 * Scale is set against the road rather than against the frame: a 9-unit
 * column is what a motorway lighting column actually stands at, and 30 units
 * against 3.5-unit lanes is real motorway spacing, not a density chosen to
 * fill the shot.
 */

const POLE_SPACING = 30
const POLE_HEIGHT = 9

// The run starts just past the camera and continues well beyond the drawn
// ribbon. Everything past ~90 units is heavily fogged, so what is actually
// being extended is the chain of lamp glows — the poles under them have
// long since dissolved, which is exactly what a real lit road looks like
// from a distance.
// 45 -> -15 once the columns stood at their real height (see `bakedGeometry`):
// the column at 15 is the nearest in front of the camera's resting pose and
// stood full height at the left edge of the reveal, behind the side
// navigation — a foreground object in a composition whose foreground is meant
// to be empty. (The one at 45 is behind the camera.)
const FIRST_S = -15
const LAST_S = -195

// The glows opt out of the scene fog (a point source is exactly what stays
// visible through haze, and at these distances fog would erase them) and carry
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
 * The source asset is a row of eight lamp designs; the production file keeps
 * only this one (its pole and its lens), which this instances down the
 * median, so the run costs one draw call per part however many columns it
 * has.
 *
 * Scaled by height rather than by arm span. Both were tried: at this
 * distance the column's height against the lanes beside it is what sets
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
    const nodes = MODEL_COLUMN_NODES.map((name) => cloneNode(gltf, name)).filter(Boolean)
    if (!nodes.length) return null
    holder.add(...nodes)

    const authored = measure(holder)
    holder.scale.setScalar(POLE_HEIGHT / authored.size.y)

    const scaled = measure(holder)
    // Stand it on the road surface and centre it on its own column, so a
    // plain position/yaw places it exactly as the cylinder was placed.
    holder.position.x -= scaled.center.x
    holder.position.z -= scaled.center.z
    holder.position.y -= scaled.box.min.y

    holder.updateWorldMatrix(true, true)
    // Baked through `bakedGeometry`: the file is quantised, and baking the
    // column's 9-unit scale straight into its integer positions clamped the
    // whole column down to a ~1-unit stump under glows hanging at full height.
    const parts = []
    holder.traverse((object) => {
      if (!object.isMesh) return
      parts.push({ geometry: bakedGeometry(object), source: object.material, isLens: /_light_/.test(object.name) })
    })

    // Where the two lenses actually are on the fitted column. The model's arms
    // run along its own Z axis, one lens at each end, so the lens geometry is
    // split by the sign of Z and each half averaged — the glows and pools are
    // placed from these rather than from a guessed reach and height.
    const lensOffsets = [new THREE.Vector3(), new THREE.Vector3()]
    const lensCounts = [0, 0]
    parts
      .filter((part) => part.isLens)
      .forEach(({ geometry }) => {
        const position = geometry.attributes.position
        for (let i = 0; i < position.count; i += 1) {
          const side = position.getZ(i) < 0 ? 0 : 1
          lensOffsets[side].x += position.getX(i)
          lensOffsets[side].y += position.getY(i)
          lensOffsets[side].z += position.getZ(i)
          lensCounts[side] += 1
        }
      })
    lensOffsets.forEach((offset, side) => offset.divideScalar(Math.max(lensCounts[side], 1)))

    return { parts, lensOffsets }
  }, [gltf])
}

/**
 * The model's own two materials, carried over as the cheaper standard type.
 *
 * `metal` keeps the file's colour and a gloss close to its clear coat. The
 * clear coat itself is dropped: it is a second specular lobe with nothing
 * here to reflect — the exterior has no environment map — so it would cost a
 * physical-material shader and add nothing visible.
 *
 * `light` is the lens under each head. The file gives it a white emissive at
 * 2.5x, which in this scene would be the brightest thing in the frame and
 * compete with the billboard; it keeps its role as a lit lens but in the same
 * warm tone as the glow sprites, at a level that reads as a lamp rather than a
 * light source of its own.
 */
function columnMaterial({ source, isLens }) {
  if (isLens) {
    return new THREE.MeshBasicMaterial({ color: GLOW_COLOR, side: THREE.DoubleSide })
  }
  return new THREE.MeshStandardMaterial({
    color: source.color,
    roughness: Math.max(source.roughness, 0.35),
    metalness: source.metalness,
    side: THREE.DoubleSide,
  })
}

export default function StreetLights() {
  const applyExteriorLayer = useExteriorLayer()
  const columns = useMemo(buildRun, [])
  const lamp = useLampColumn()
  const glowMap = useMemo(glowTexture, [])
  const poolMap = useMemo(poolTexture, [])
  const materials = useMemo(() => (lamp ? lamp.parts.map(columnMaterial) : []), [lamp])

  const { poleMatrices, poolMatrices, glowPositions, glowColors } = useMemo(() => {
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const lens = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3(1, 1, 1)
    const up = new THREE.Vector3(0, 1, 0)
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
    const color = new THREE.Color()

    const poles = []
    const pools = []
    const glowPositions = new Float32Array(columns.length * 2 * 3)
    const glowColors = new Float32Array(columns.length * 2 * 3)
    if (!lamp) return { poleMatrices: poles, poolMatrices: pools, glowPositions, glowColors }

    columns.forEach((column, i) => {
      // A quarter turn past the road's own heading: the model's arms run along
      // its Z axis, and this double-arm column stands in the median to reach
      // out over both carriageways, not along the median itself.
      quaternion.setFromAxisAngle(up, column.yaw + Math.PI / 2)

      // The column itself sits ON the road surface — the model was fitted
      // with its base at zero.
      position.set(column.x, groundY, column.z)
      poles.push(matrix.compose(position, quaternion, scale).clone())

      const fade = Math.exp(-Math.pow(GLOW_FALLOFF * column.distance, 2))
      color.copy(GLOW_COLOR).multiplyScalar(0.35 + fade * 0.65)

      // One glow just under each measured lens, and its pool on the road
      // directly beneath — both follow the column's own transform, so they
      // cannot drift off the heads.
      lamp.lensOffsets.forEach((offset, side) => {
        lens.copy(offset).applyQuaternion(quaternion).add(position)
        const slot = i * 2 + side

        pools.push(matrix.compose(new THREE.Vector3(lens.x, groundY + 0.03, lens.z), flat, scale).clone())

        glowPositions[slot * 3] = lens.x
        glowPositions[slot * 3 + 1] = lens.y - 0.12
        glowPositions[slot * 3 + 2] = lens.z
        glowColors[slot * 3] = color.r
        glowColors[slot * 3 + 1] = color.g
        glowColors[slot * 3 + 2] = color.b
      })
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
      {lamp?.parts.map((part, index) => (
        <instancedMesh
          key={index}
          ref={applyMatrices(poleMatrices)}
          args={[part.geometry, materials[index], columns.length]}
          frustumCulled={false}
        />
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
