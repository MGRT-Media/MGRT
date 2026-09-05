import * as THREE from 'three'
import { ROAD_S_FAR, ROAD_S_NEAR, groundY, roadFrame, roadFramePoint } from './highway.js'

/**
 * The desert floor and the river cut through it — shared by the ground mesh
 * and the water, which have to agree about where the bed is.
 *
 * The terrain is a height function rather than a mesh: everything that needs
 * to sit on the ground asks it for a height, so nothing can end up buried or
 * floating. It also owns the two corridors — the carriageway and the
 * riverbed — because those are subtractions FROM the dunes, and putting them
 * anywhere else would mean the dunes and the things cut into them could
 * drift apart.
 */

// Gentle, long-wavelength dunes. Amplitude is small on purpose: the shot is
// a wide night landscape and this only has to break the flatness, not
// become scenery in its own right.
export function duneHeight(x, z) {
  return (
    1.9 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.4) +
    1.15 * Math.sin(x * 0.045 - 2.1) * Math.sin(z * 0.038 + 1.7) +
    0.45 * Math.sin((x + z) * 0.088 + 0.6)
  )
}

// The river, written in the road's own frame (distance along, distance
// across) rather than in world coordinates, so it stays put relative to the
// highway and the billboard however those move.
//
// It runs BEYOND the far carriageway, not on the billboard's side. The
// obvious placement — the open desert to the right of the board — was tried
// and projected almost entirely behind the board itself, which occupies
// -1% to 68% of the frame at the reveal. The left is the side the
// composition actually leaves open, and putting the water past the road
// there also stacks the landscape properly: carriageway, then desert, then
// river, then mountains. It never crosses the road, so no bridge is needed.
const RIVER_PATH = [
  [60, -20],
  [10, -26],
  [-45, -32],
  [-105, -38],
  [-170, -42],
  [-235, -44],
]
export const RIVER_HALF_WIDTH = 11
const RIVER_DEPTH = 1.5
const RIVER_BANK = 15

export const RIVER_CURVE = new THREE.CatmullRomCurve3(
  RIVER_PATH.map(([s, lateral]) => roadFramePoint(s, lateral).setY(groundY)),
  false,
  'centripetal',
)
export const RIVER_WATER_Y = groundY - RIVER_DEPTH * 0.55

// Sampled once so the terrain can measure its distance to the river without
// re-walking the curve for every one of ~9,000 vertices.
const RIVER_SAMPLES = RIVER_CURVE.getSpacedPoints(160)

function distanceToRiver(x, z) {
  let best = Infinity
  for (const sample of RIVER_SAMPLES) {
    const d = (x - sample.x) * (x - sample.x) + (z - sample.z) * (z - sample.z)
    if (d < best) best = d
  }
  return Math.sqrt(best)
}

const CARRIAGEWAY_FLAT = 15
const CARRIAGEWAY_BLEND = 36

/**
 * Height of the desert floor above `groundY` at a world position — dunes,
 * with the carriageway levelled flat and the riverbed cut down through it.
 */
export function terrainHeight(x, z, scratch) {
  let height = duneHeight(x, z)

  // Carriageway: level, and only for the stretch the road actually occupies
  // — past its ends the dunes close back over where it would have been.
  const { s, lateral } = roadFrame(x, z, scratch)
  if (s > ROAD_S_FAR - 40 && s < ROAD_S_NEAR + 40) {
    const across = Math.abs(lateral)
    height *= THREE.MathUtils.smoothstep(across, CARRIAGEWAY_FLAT, CARRIAGEWAY_BLEND)
  }

  // Riverbed: a bank falling to the bed, so the water has something to sit
  // in rather than lying on top of the sand.
  const toRiver = distanceToRiver(x, z)
  if (toRiver < RIVER_BANK) {
    const bank = THREE.MathUtils.smoothstep(toRiver, RIVER_HALF_WIDTH * 0.55, RIVER_BANK)
    height = THREE.MathUtils.lerp(-RIVER_DEPTH, height, bank)
  }

  return height
}
