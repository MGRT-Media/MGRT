import * as THREE from 'three'
import { fbm3, ridged3, pits3 } from './stoneNoise.js'

/**
 * Ruined column geometry — twelve individually weathered shafts rather than
 * twelve instances of one perfect solid of revolution.
 *
 * Three things have to be true at once or the shaft reads as a cylinder with
 * a picture on it, and each was a separate failure on the way here:
 *
 * 1. **The mesh must be dense enough to hold relief.** A classical profile
 *    needs ~8 control points, which after revolving is 7 vertex rows over a
 *    9-unit shaft. Displacement can only move vertices that exist, so nothing
 *    finer than ~1.3 units could exist at all. `PROFILE_SPACING` resamples
 *    the same silhouette to a uniform ~5cm.
 *
 * 2. **The noise must not be periodic.** Relief built from sums of sines in
 *    (angle, height) is smooth and exactly repeating, and the angular terms
 *    have to be whole numbers to avoid a seam — which is what produced
 *    evenly spaced identical channels. `stoneNoise.js` samples a 3D field at
 *    each vertex instead: seamless on a closed surface for free, and free to
 *    be irregular. Cracks come from ridged noise and pockets from thresholded
 *    noise, because ordinary fbm has no sharp features and cannot make either.
 *
 * 3. **The silhouette must break.** Surface detail alone leaves a ruler-
 *    straight edge against the light, which reads as a primitive no matter
 *    what the material does. `DRUM_HEIGHT` below is the main instrument for
 *    that: the drums are individually shifted and resized, so the outline
 *    steps.
 *
 * Cost is paid once at mount — twelve geometries, ~64 × 180 vertices each, no
 * runtime work and no extra draw calls.
 *
 * **Outward displacement is capped.** `PILLAR_SHAFT_RADIUS` is what the
 * camera path's pillar clearances were measured against, so an unbounded
 * shaft would silently eat into them. `MAX_OUTWARD` keeps the worst case well
 * inside it. Inward
 * cuts are unbounded: erosion removes stone, which is the safe direction and
 * the physically correct one, and it is where most of this relief lives.
 */

const PROFILE_SPACING = 0.05
const RADIAL_SEGMENTS = 64
const MAX_OUTWARD = 0.07

/**
 * Nominal height of one drum — the actual courses jitter around it. A column this size was built as a stack of cylindrical
 * blocks, and after centuries they no longer sit true — the joints open, the
 * drums shift a few centimetres off axis and no two present the same radius.
 * That misalignment is the strongest single cue that the shaft is masonry
 * rather than a turned solid, because it breaks the vertical edge at hard,
 * irregular steps that no amount of surface noise can imitate.
 */
const DRUM_HEIGHT = 0.92

/** Deterministic per-column PRNG, so a given index always rebuilds identically. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The column's condition. Fixed per index rather than random so the ring's
 * composition is stable across reloads: the ruin reads as a place that has
 * stood this way, not as a shuffle that redeals every refresh. Broken shafts
 * are a minority — a ring where every column is snapped reads as debris.
 */
function conditionFor(index) {
  if (index === 2 || index === 7) return 'truncated'
  if (index === 5) return 'halfBroken'
  if (index === 0 || index === 4 || index === 9) return 'worn'
  return 'intact'
}

function intactProfile(height, radii, condition, rand) {
  const { base, shaft, capital } = radii
  const plinthHeight = 0.16
  const capitalHeight = 0.22
  const wear = condition === 'worn' ? 0.045 + rand() * 0.03 : 0

  return [
    new THREE.Vector2(base, 0),
    new THREE.Vector2(base * (1 - wear * 0.4), plinthHeight * 0.6),
    new THREE.Vector2(shaft, plinthHeight),
    new THREE.Vector2(shaft * 0.96, height - capitalHeight),
    new THREE.Vector2(shaft, height - capitalHeight),
    new THREE.Vector2(capital * (1 - wear), height - capitalHeight * 0.5),
    new THREE.Vector2(capital * (1 - wear * 1.8), height - capitalHeight * 0.12),
    new THREE.Vector2(capital * (1 - wear * 3.2), height),
  ]
}

function brokenProfile(breakHeight, radii, rand) {
  const { base, shaft } = radii
  const plinthHeight = 0.16
  const lip = 0.92 + rand() * 0.1

  return [
    new THREE.Vector2(base, 0),
    new THREE.Vector2(base * 0.97, plinthHeight * 0.6),
    new THREE.Vector2(shaft, plinthHeight),
    new THREE.Vector2(shaft * 0.97, breakHeight - 0.35),
    new THREE.Vector2(shaft * lip, breakHeight - 0.06),
    new THREE.Vector2(shaft * 0.72, breakHeight),
    new THREE.Vector2(shaft * 0.34, breakHeight - 0.05),
    new THREE.Vector2(0, breakHeight - 0.12),
  ]
}

/** Subdivide the control profile to a uniform spacing. See note 1 above. */
function resampleProfile(points, spacing) {
  const dense = [points[0].clone()]
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1]
    const to = points[i]
    const steps = Math.max(1, Math.ceil(from.distanceTo(to) / spacing))
    for (let step = 1; step <= steps; step += 1) {
      dense.push(from.clone().lerp(to, step / steps))
    }
  }
  return dense
}

/**
 * Per-drum displacement: how far this drum has shifted off axis, and how its
 * radius differs from nominal. Generated once per column and looked up by
 * height, so every vertex in a drum moves together and the joint stays a hard
 * step rather than a smooth blend.
 */
function buildDrums(totalHeight, rand) {
  const drums = []
  let y = 0
  // Courses are not a uniform pitch. Quarried drums vary, and equal spacing
  // was reading as a rhythm — the repeating-pattern tell this pass exists to
  // remove — so each course takes its own height.
  while (y < totalHeight + DRUM_HEIGHT) {
    const height = DRUM_HEIGHT * (0.74 + rand() * 0.52)
    drums.push({
      top: y + height,
      // A few centimetres off true. Enough to step the outline, not enough to
      // read as a stack of separate objects.
      offsetX: (rand() - 0.5) * 0.032,
      offsetZ: (rand() - 0.5) * 0.032,
      // A joint shows a ledge, not a bulge: this stays tight to 1.
      radiusScale: 0.985 + rand() * 0.022,
    })
    y += height
  }
  return drums
}

function drumAt(drums, y) {
  for (let i = 0; i < drums.length; i += 1) {
    if (y < drums[i].top) return drums[i]
  }
  return drums[drums.length - 1]
}

export function buildColumnGeometry(fullHeight, index, shaftRadius) {
  const rand = mulberry32(index * 2654435761 + 12345)
  const condition = conditionFor(index)
  const seed = index * 7919 + 13

  const radii = {
    base: 0.4 * (0.94 + rand() * 0.06),
    shaft: shaftRadius * (0.95 + rand() * 0.05),
    capital: 0.36 * (0.93 + rand() * 0.07),
  }

  let controlPoints
  let breakHeight = null
  if (condition === 'truncated') {
    breakHeight = fullHeight * (0.42 + rand() * 0.16)
    controlPoints = brokenProfile(breakHeight, radii, rand)
  } else if (condition === 'halfBroken') {
    breakHeight = fullHeight * (0.66 + rand() * 0.12)
    controlPoints = brokenProfile(breakHeight, radii, rand)
  } else {
    controlPoints = intactProfile(fullHeight, radii, condition, rand)
  }

  const geometry = new THREE.LatheGeometry(
    resampleProfile(controlPoints, PROFILE_SPACING),
    RADIAL_SEGMENTS,
  )

  const severity = condition === 'intact' ? 0.8 : condition === 'worn' ? 1.05 : 1.3
  const drums = buildDrums(fullHeight, rand)

  // Flutes, but not machined ones. The channel count is fractional and the
  // phase is dragged around by a slow noise field, so the channels wander,
  // vary in width, run out and reappear — the opposite of the evenly spaced
  // identical grooves an exact cosine produced.
  const fluteCount = 14 + rand() * 7
  const fluteDepth = (0.012 + rand() * 0.014) * severity
  const flutePhase = rand() * Math.PI * 2

  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i)
    const radius = Math.hypot(vertex.x, vertex.z)
    // The axis vertex closing a broken crown must stay on the axis.
    if (radius < 0.02) continue

    const theta = Math.atan2(vertex.z, vertex.x)
    const y = vertex.y
    // Sample position for the 3D fields. Kept in world-ish scale so features
    // are sized in metres rather than in units of the shaft's radius.
    const sx = vertex.x
    const sy = vertex.y
    const sz = vertex.z

    // Broad contour: the shaft is not straight, and does not have a constant
    // section. Low frequency, high amplitude — this is what the silhouette
    // actually shows at distance.
    const contour = fbm3(sx * 1.3, sy * 0.55, sz * 1.3, 3, seed) * 0.05 * severity

    // Medium bumps and hollows — the forms a raking light breaks over.
    const bumps = fbm3(sx * 4.5, sy * 2.6, sz * 4.5, 4, seed + 91) * 0.022 * severity

    // Granular surface, right at the limit of what the mesh can carry. Finer
    // detail than this is the normal map's job.
    const grain = fbm3(sx * 17, sy * 13, sz * 17, 3, seed + 211) * 0.006 * severity

    // Cracks: ridged noise, cut inward only. Raising it to a power keeps the
    // crease narrow instead of spreading it into a broad valley.
    const crackField = ridged3(sx * 2.4, sy * 1.5, sz * 2.4, 4, seed + 337)
    const crack = -Math.pow(Math.max(0, crackField - 0.55) / 0.45, 2) * 0.055 * severity

    // Erosion pockets — sparse, deep, defined edge.
    const pocket = -pits3(sx * 3.2, sy * 2.1, sz * 3.2, seed + 613, 0.46) * 0.075 * severity

    // Wandering flutes.
    const fluteDrift = fbm3(sx * 0.9, sy * 0.35, sz * 0.9, 2, seed + 77) * 1.6
    const fluteMask = THREE.MathUtils.clamp(
      0.5 + 0.9 * fbm3(sx * 0.7, sy * 0.5, sz * 0.7, 2, seed + 149),
      0,
      1,
    )
    const flute =
      -fluteDepth * fluteMask * (0.5 + 0.5 * Math.cos(fluteCount * theta + flutePhase + fluteDrift))

    let displacement = contour + bumps + grain + crack + pocket + flute

    if (breakHeight !== null) {
      const nearness = THREE.MathUtils.smoothstep(y, breakHeight - 1.0, breakHeight)
      if (nearness > 0) {
        const fracture = ridged3(sx * 3.1, sy * 2.4, sz * 3.1, 3, seed + 881)
        displacement -= fracture * 0.09 * nearness
        vertex.y -= fracture * 0.3 * nearness
      }
    }

    if (displacement > MAX_OUTWARD) displacement = MAX_OUTWARD

    const scale = Math.max(radius + displacement, 0.02) / radius
    vertex.x *= scale
    vertex.z *= scale

    // Drum shift, applied last so it moves the finished surface as a block.
    // Faded out across the plinth and the capital, which are single stones.
    const drum = drumAt(drums, y)
    const shaftMask =
      THREE.MathUtils.smoothstep(y, 0.16, 0.75) *
      (1 - THREE.MathUtils.smoothstep(y, fullHeight - 0.5, fullHeight - 0.1))
    if (shaftMask > 0) {
      const drumScale = 1 + (drum.radiusScale - 1) * shaftMask
      vertex.x *= drumScale
      vertex.z *= drumScale
      vertex.x += drum.offsetX * shaftMask
      vertex.z += drum.offsetZ * shaftMask
    }

    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}
