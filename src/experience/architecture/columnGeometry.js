import * as THREE from 'three'

/**
 * Ruined column geometry — twelve individually weathered shafts rather than
 * twelve instances of one perfect solid of revolution.
 *
 * The ring originally shared a single `LatheGeometry`. A lathe is exactly a
 * solid of revolution, so every horizontal slice was a mathematically perfect
 * circle and every column was the same object turned to a different angle.
 * That is the "procedural primitive" read: not the polygon count, but the
 * fact that no cross-section anywhere in the room deviated from a circle.
 *
 * **The profile is resampled before anything is displaced, and that is the
 * whole reason this works.** A classical column profile needs about eight
 * control points to describe it, which gives seven rows of vertices over a
 * nine-unit shaft — roughly one row per 1.3 units. Displacement can only move
 * vertices that exist, so on that mesh every ridge, groove and chip below
 * ~1.3 units tall had nowhere to live and the surface stayed a clean cylinder
 * no matter how strong the noise driving it. `PROFILE_SPACING` resamples the
 * same silhouette to a uniform ~7cm, which is what gives the relief below
 * something to actually deform.
 *
 * Cost is still modest and still paid once at mount: ~64 × 130 vertices per
 * column, twelve geometries, no runtime work and no extra draw calls.
 *
 * **Outward displacement is capped on purpose.** `PILLAR_SHAFT_RADIUS` feeds
 * `cameraPath.js`'s rail clearance (`CAMPAIGNS_RAIL_PILLAR_CLEARANCE`, 0.25),
 * so a shaft free to swell would silently eat a clearance another module has
 * been derived against. Inward cuts are left unbounded — erosion removes
 * stone, which is both the safe direction and the physically correct one, and
 * it is where most of this relief lives anyway.
 */

/** Vertex row spacing along the profile, in world units. See the module note. */
const PROFILE_SPACING = 0.07
const RADIAL_SEGMENTS = 64

/** Hard ceiling on how far any point may bulge past its nominal radius. */
const MAX_OUTWARD = 0.038

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
 * Band-limited surface noise in cylindrical space, seamless around the shaft
 * by construction.
 *
 * Every term uses an *integer* multiple of the angle, so the field meets
 * itself exactly at theta = 0 and no seam runs up the column — the failure a
 * lattice noise sampled on (x, z) would have produced. The octaves are read
 * in bands: the first two are the primary form (bulge and lean), the middle
 * two are ridges and bumps, the last two are granular break-up.
 */
const LOBES = [
  { angular: 1, vertical: 0.18, amplitude: 1.0 },
  { angular: 2, vertical: 0.31, amplitude: 0.85 },
  { angular: 3, vertical: 0.74, amplitude: 0.62 },
  { angular: 5, vertical: 1.35, amplitude: 0.44 },
  { angular: 8, vertical: 2.6, amplitude: 0.3 },
  { angular: 13, vertical: 4.7, amplitude: 0.19 },
  { angular: 21, vertical: 8.3, amplitude: 0.12 },
  { angular: 34, vertical: 14.1, amplitude: 0.07 },
]

function bandNoise(theta, y, phases, from, to) {
  let sum = 0
  let weight = 0
  for (let i = from; i < to; i += 1) {
    const lobe = LOBES[i]
    sum +=
      lobe.amplitude *
      Math.sin(lobe.angular * theta + phases[i]) *
      Math.sin(lobe.vertical * y + phases[i] * 1.7)
    weight += lobe.amplitude
  }
  return weight > 0 ? sum / weight : 0
}

/**
 * The column's condition. Fixed per index rather than random so the ring's
 * composition is stable across reloads: the ruin reads as a place that has
 * stood this way, not as a shuffle that redeals every refresh.
 *
 * Kept to a minority of broken shafts — a ring where every column is snapped
 * reads as debris, not as architecture that has survived.
 */
function conditionFor(index) {
  if (index === 2 || index === 7) return 'truncated'
  if (index === 5) return 'halfBroken'
  if (index === 0 || index === 4 || index === 9) return 'worn'
  return 'intact'
}

/** Profile of a column that still carries its capital. */
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

/**
 * Profile of a shaft that has lost its upper section. The break is closed
 * back to the axis so the column is not a hollow tube — the crown is then
 * roughened by the displacement pass, which is what makes it read as
 * fractured stone rather than a lathe-turned lid.
 */
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

/**
 * Subdivide the control profile to a uniform spacing. See the module note —
 * without this there is nothing for the relief to displace.
 */
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
 * One column, weathered on its own terms.
 *
 * `fullHeight` is the intact height (the hall's), `index` selects the stable
 * condition and seeds every jitter below it.
 */
export function buildColumnGeometry(fullHeight, index, shaftRadius) {
  const rand = mulberry32(index * 2654435761 + 12345)
  const condition = conditionFor(index)

  // Per-column proportions. The jitter is one-sided below the nominal radius,
  // for the same clearance reason as MAX_OUTWARD.
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

  // --- weathering ------------------------------------------------------
  const phases = Array.from({ length: LOBES.length }, () => rand() * Math.PI * 2)
  const severity = condition === 'intact' ? 0.75 : condition === 'worn' ? 1.0 : 1.25

  // Flutes: the one piece of Greek column language that is structural rather
  // than decorative, and the strongest light-catcher available — vertical
  // channels turn a single grazing source into alternating highlight and
  // shadow all the way up the shaft. Count and depth vary per column, and the
  // depth is modulated along the height so they weather away in patches
  // rather than running the full length like machined splines.
  const fluteCount = 16 + Math.floor(rand() * 6)
  const fluteDepth = (0.014 + rand() * 0.016) * severity
  const flutePhase = rand() * Math.PI * 2

  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i)
    const radius = Math.hypot(vertex.x, vertex.z)
    // The axis vertex closing a broken crown has no meaningful angle and must
    // stay on the axis, or the cap tears open.
    if (radius < 0.02) continue

    const theta = Math.atan2(vertex.z, vertex.x)
    const y = vertex.y

    // Primary form: a slow bulge and warp, so the shaft is not a straight
    // extrusion even before any detail lands on it.
    const bulge = bandNoise(theta, y, phases, 0, 2) * 0.026 * severity
    // Ridges and bumps — the medium forms the light actually breaks over.
    const ridges = bandNoise(theta, y, phases, 2, 4) * 0.032 * severity
    // Granular break-up.
    const grain = bandNoise(theta, y, phases, 4, LOBES.length) * 0.014 * severity

    // Flutes, faded in and out along the height by a slow band so stretches
    // of the shaft have lost them entirely.
    const fluteMask = Math.max(0, 0.55 + 0.45 * Math.sin(y * 0.42 + flutePhase * 2.3))
    const flute = -fluteDepth * fluteMask * (0.5 + 0.5 * Math.cos(fluteCount * theta + flutePhase))

    // Chips and spalled patches: sparse, hard-edged, inward only. Squaring the
    // bite past the threshold keeps most of the surface untouched and makes
    // the few hits deep, which is how stone actually fails.
    const chipNoise = bandNoise(theta * 1.9 + 4.1, y * 1.6 - 2.7, phases, 1, 5)
    const bite = Math.max(0, chipNoise - 0.28) / 0.72
    const chip = -bite * bite * 0.075 * severity

    let displacement = bulge + ridges + grain + flute + chip

    // Broken crowns lose material fastest at the fracture.
    if (breakHeight !== null) {
      const nearness = THREE.MathUtils.smoothstep(y, breakHeight - 0.9, breakHeight)
      if (nearness > 0) {
        const fracture = bandNoise(theta * 1.7 + 2.1, y * 2.3, phases, 2, 6)
        displacement -= Math.abs(fracture) * 0.08 * nearness
        // ...and the fracture line itself is not level.
        vertex.y -= Math.max(0, fracture) * 0.26 * nearness
      }
    }

    // Cap outward growth only — see the module note on rail clearance.
    if (displacement > MAX_OUTWARD) displacement = MAX_OUTWARD

    const scale = Math.max(radius + displacement, 0.02) / radius
    vertex.x *= scale
    vertex.z *= scale
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}
