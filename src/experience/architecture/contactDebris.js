import * as THREE from 'three'
import { fbm3, ridged3, pits3 } from './stoneNoise.js'
import { planPoint, GALLERY_SHELL } from './galleryShellGeometry.js'

/**
 * The material that has accumulated where surfaces meet.
 *
 * Every mesh in this room ends at a mathematically exact boundary: a column
 * is a solid of revolution that stops at y = 0, the floor is a plane that
 * runs underneath it, and the wall is a swept shell that meets that same
 * plane at a clean intersection. Nothing is wrong with any one of those
 * surfaces — the tell is the *joins*. A real ruin has no clean joins,
 * because centuries of spall, wind-blown dust and broken stone collect in
 * exactly the places two surfaces meet and never get swept out.
 *
 * So the fix is not to soften the meshes but to add the material that should
 * already be sitting in the corner. Two pieces of geometry, both low and both
 * irregular:
 *
 *  - `buildColumnCollar` — a mound banked against each column's foot.
 *  - `buildWallSkirt`    — a run of debris along the base of the shell.
 *
 * Both are deliberately asymmetric and both are built from the same
 * `stoneNoise` fields as the columns, so the language of the erosion matches.
 * A symmetric ring at a column base would read as a moulding — the one thing
 * this must not become — so the outward spread is itself driven by noise and
 * varies all the way around.
 *
 * Both are drawn with the FLOOR material. Debris on a floor is floor: it is
 * the same dust and the same broken stone, so it takes the same scan, at the
 * same world scale, and the transition carries no change in texture density,
 * tint or direction — which is what stops the addition reading as a third
 * object introduced between the first two.
 */

/** How far the debris banks out from a column, before per-angle variation. */
const COLLAR_SPREAD = 0.42
/** Height of the mound where it touches the shaft. */
const COLLAR_HEIGHT = 0.075
/** How far the wall debris reaches into the room. */
const SKIRT_REACH = 0.85
const SKIRT_HEIGHT = 0.1

/**
 * Everything here starts marginally below zero.
 *
 * The floor is not flat — `useFloorGeometry` displaces it by a few centimetres
 * of relief and settlement — so debris sitting exactly at y = 0 would hover
 * over every dip in it. Starting below the plane guarantees the two always
 * interpenetrate, and the buried part is never seen.
 */
const BURY = 0.05

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ANGULAR_SEGMENTS = 72
const RADIAL_STEPS = 8

/**
 * A mound of fallen material banked against a column's foot.
 *
 * The profile is a power curve, not a fillet: thickest against the shaft and
 * thinning to nothing at its outer edge, the way loose material actually
 * comes to rest. `radiating` then cuts channels that run outward from the
 * shaft — the rain-scoured fissures that form where water sheds off a column
 * and runs away across the floor.
 */
export function buildColumnCollar(shaftRadius, index) {
  const rand = mulberry32(index * 40503 + 7)
  const seed = index * 3301 + 91
  const phase = rand() * Math.PI * 2

  const inner = shaftRadius * 0.9
  const positions = []
  const uvs = []
  const indices = []

  for (let a = 0; a <= ANGULAR_SEGMENTS; a += 1) {
    const theta = (a / ANGULAR_SEGMENTS) * Math.PI * 2
    const dirX = Math.cos(theta)
    const dirZ = Math.sin(theta)

    // How far the pile reaches at this angle. Sampled from a 3D field on the
    // unit circle so it is seamless at the wrap, and heavily varied so the
    // mound is banked up on one side and almost absent on another.
    const spreadNoise = fbm3(dirX * 2.1 + phase, index * 3.7, dirZ * 2.1, 3, seed)
    const spread = COLLAR_SPREAD * (0.45 + 0.85 * (spreadNoise * 0.5 + 0.5))

    // Radial scour channels. Ridged noise gives them a defined edge instead
    // of a soft dimple, and they are cut, never raised.
    const radiating = ridged3(dirX * 5.5, phase, dirZ * 5.5, 3, seed + 77)
    const channel = Math.pow(Math.max(0, radiating - 0.6) / 0.4, 2)

    for (let r = 0; r <= RADIAL_STEPS; r += 1) {
      const t = r / RADIAL_STEPS
      const radius = inner + spread * t
      const x = dirX * radius
      const z = dirZ * radius

      // Thickest at the shaft, nothing at the rim.
      let height = COLLAR_HEIGHT * Math.pow(1 - t, 1.7)
      height *= 0.75 + 0.5 * (fbm3(x * 6, phase * 2, z * 6, 3, seed + 211) * 0.5 + 0.5)
      height -= channel * COLLAR_HEIGHT * 0.55 * (1 - t)
      height -= pits3(x * 9, phase, z * 9, seed + 401, 0.5) * COLLAR_HEIGHT * 0.5

      positions.push(x, height - BURY * t, z)
      // UVs in world scale so the floor scan lands at exactly the density it
      // has on the floor itself — see the module note on material continuity.
      uvs.push(x, z)
    }
  }

  const rowStride = RADIAL_STEPS + 1
  for (let a = 0; a < ANGULAR_SEGMENTS; a += 1) {
    for (let r = 0; r < RADIAL_STEPS; r += 1) {
      const i0 = a * rowStride + r
      const i1 = i0 + 1
      const i2 = (a + 1) * rowStride + r
      const i3 = i2 + 1
      indices.push(i0, i2, i1, i1, i2, i3)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const SKIRT_ANGULAR_SEGMENTS = 420
const SKIRT_STEPS = 6

/**
 * A run of collapsed material along the foot of the shell.
 *
 * Follows `planPoint` exactly rather than an approximation of it, so the
 * inner edge of the wall and the outer edge of the debris are the same curve
 * and can never separate.
 *
 * Faded out across the mouth, where at floor level there is no wall for
 * anything to have fallen from — see `OPENING_HALF_ANGLE` in
 * `galleryShellGeometry.js`, which removes the shell entirely over that arc.
 */
export function buildWallSkirt(seed = 17) {
  const positions = []
  const uvs = []
  const indices = []
  const opening = GALLERY_SHELL.openingHalfAngle

  for (let a = 0; a <= SKIRT_ANGULAR_SEGMENTS; a += 1) {
    const theta = (a / SKIRT_ANGULAR_SEGMENTS) * Math.PI * 2
    // theta is measured from +Z, and the mouth is centred on it.
    const fromMouth = Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta)))
    // Fade in over ~12° past the opening edge rather than starting abruptly,
    // which would leave a visible step where the run begins.
    const mouthMask = THREE.MathUtils.smoothstep(fromMouth, opening, opening + 0.21)

    const outer = planPoint(theta)
    const length = Math.hypot(outer.x, outer.z)
    const inX = outer.x / length
    const inZ = outer.z / length

    const reachNoise = fbm3(inX * 3.4, theta * 0.6, inZ * 3.4, 3, seed)
    const reach = SKIRT_REACH * (0.4 + 0.9 * (reachNoise * 0.5 + 0.5)) * mouthMask

    for (let r = 0; r <= SKIRT_STEPS; r += 1) {
      // t: 0 at the wall, 1 at the inner edge of the debris.
      const t = r / SKIRT_STEPS
      const x = outer.x - inX * reach * t
      const z = outer.z - inZ * reach * t

      let height = SKIRT_HEIGHT * Math.pow(1 - t, 1.9) * mouthMask
      height *= 0.6 + 0.8 * (fbm3(x * 2.4, theta, z * 2.4, 4, seed + 53) * 0.5 + 0.5)
      // Broken slabs and gaps along the run, so it is not a continuous fillet.
      height -= pits3(x * 1.7, theta * 0.5, z * 1.7, seed + 149, 0.44) * SKIRT_HEIGHT * 0.8

      positions.push(x, Math.max(height, -BURY) - BURY * t, z)
      uvs.push(x, z)
    }
  }

  const rowStride = SKIRT_STEPS + 1
  for (let a = 0; a < SKIRT_ANGULAR_SEGMENTS; a += 1) {
    for (let r = 0; r < SKIRT_STEPS; r += 1) {
      const i0 = a * rowStride + r
      const i1 = i0 + 1
      const i2 = (a + 1) * rowStride + r
      const i3 = i2 + 1
      indices.push(i0, i1, i2, i1, i3, i2)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
