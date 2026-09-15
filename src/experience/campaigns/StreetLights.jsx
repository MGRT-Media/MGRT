import { useMemo } from 'react'
import * as THREE from 'three'
import { centrelinePoint, groundY } from './highway.js'
import { useExteriorLayer } from './layers.js'
import { MODEL_URLS, bakedGeometry, cloneNode, measure, useModel } from '../models/modelAssets.js'

/**
 * Lighting columns down the median, running away into the distance.
 *
 * Entirely static — there is no per-frame work at all here: the positions are
 * baked once into the column instances, one draw call per model part however
 * many columns there are.
 *
 * Scale is set against the road rather than against the frame: a 9-unit
 * column is what a motorway lighting column actually stands at, and 30 units
 * against 3.5-unit lanes is real motorway spacing, not a density chosen to
 * fill the shot.
 *
 * The act is in daylight, so the lamps are off: no glows and no pools of
 * light on the road, and the lenses read as unlit diffusers. The columns cast
 * shadows across the carriageway from the exterior sun.
 */

const POLE_SPACING = 30
const POLE_HEIGHT = 9

// The run starts just past the camera and continues well beyond the drawn
// ribbon, into the haze.
// 45 -> -15 once the columns stood at their real height (see `bakedGeometry`):
// the column at 15 is the nearest in front of the camera's resting pose and
// stood full height at the left edge of the reveal, behind the side
// navigation — a foreground object in a composition whose foreground is meant
// to be empty. (The one at 45 is behind the camera.)
const FIRST_S = -15
const LAST_S = -195

function buildRun() {
  const columns = []
  const point = new THREE.Vector3()
  const ahead = new THREE.Vector3()
  for (let s = FIRST_S; s >= LAST_S; s -= POLE_SPACING) {
    centrelinePoint(s, point)
    centrelinePoint(s - 1, ahead)
    columns.push({ x: point.x, z: point.z, yaw: Math.atan2(ahead.x - point.x, ahead.z - point.z) })
  }
  return columns
}

/**
 * One lamp column from `street-lights.glb`.
 *
 * The source asset is a row of eight lamp designs; the production file keeps
 * only this one (its pole and its lens), which this instances down the
 * median.
 *
 * Scaled by height rather than by arm span: at this distance the column's
 * height against the lanes beside it is what sets the sense of scale, while
 * the arm span is barely readable.
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
    // Stand it on the road surface and centre it on its own column.
    holder.position.x -= scaled.center.x
    holder.position.z -= scaled.center.z
    holder.position.y -= scaled.box.min.y

    holder.updateWorldMatrix(true, true)
    // Baked through `bakedGeometry`: the file is quantised, and baking the
    // column's 9-unit scale straight into its integer positions clamped the
    // whole column down to a ~1-unit stump.
    const parts = []
    holder.traverse((object) => {
      if (!object.isMesh) return
      parts.push({ geometry: bakedGeometry(object), source: object.material, isLens: /_light_/.test(object.name) })
    })
    return { parts }
  }, [gltf])
}

/**
 * The model's own two materials, carried over as the cheaper standard type.
 *
 * `metal` keeps the file's colour and a gloss close to its clear coat; the clear
 * coat itself is dropped, since a second specular lobe is not worth a physical
 * material on a thin column seen from tens of metres.
 *
 * `light` is the lens under each head. The file makes it a strong white
 * emitter, which is a lamp switched on; in daylight it is a pale frosted
 * diffuser instead, lit by the sun and sky like everything else.
 */
function columnMaterial({ source, isLens }) {
  if (isLens) {
    return new THREE.MeshStandardMaterial({ color: '#d8d4ca', roughness: 0.35, metalness: 0, side: THREE.DoubleSide })
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
  const materials = useMemo(() => (lamp ? lamp.parts.map(columnMaterial) : []), [lamp])

  const poleMatrices = useMemo(() => {
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3(1, 1, 1)
    const up = new THREE.Vector3(0, 1, 0)
    return columns.map((column) => {
      // A quarter turn past the road's own heading: the model's arms run along
      // its Z axis, and this double-arm column stands in the median to reach
      // out over both carriageways, not along the median itself.
      quaternion.setFromAxisAngle(up, column.yaw + Math.PI / 2)
      position.set(column.x, groundY, column.z)
      return matrix.compose(position, quaternion, scale).clone()
    })
  }, [columns])

  const applyMatrices = (mesh) => {
    if (!mesh) return
    poleMatrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    mesh.instanceMatrix.needsUpdate = true
  }

  return (
    <group ref={applyExteriorLayer}>
      {lamp?.parts.map((part, index) => (
        <instancedMesh
          key={index}
          ref={applyMatrices}
          args={[part.geometry, materials[index], columns.length]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
