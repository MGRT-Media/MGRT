import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildColumnGeometry } from './columnGeometry.js'
import { WALL_INSCRIPTION, wallPointAtArc } from './wallInscription.js'
import { applyStoneMacroVariation } from '../materials/stoneMacroVariation.js'

/**
 * Two engaged half-columns framing the MGRT wordmark.
 *
 * Built from the room's own column generator — same profile language, same
 * wandering flutes, cracks, pits and drum offsets — so they are cut from the
 * same stone as the ring rather than being a second, cleaner design. Each is
 * set with its axis ON the wall surface, so exactly half stands proud: a
 * D-shaped section with the flat side in the wall, which is what an engaged
 * column is. The half behind the wall is trimmed away (see `trimBehindWall`).
 *
 * Placement is measured against the hero shot, not chosen by eye:
 *
 *  - the wordmark's ink spans +/-3.53m along the wall from the band centre;
 *  - the hero hold shows +/-4.24m (4:3) to +/-4.35m (21:9) of wall;
 *  - so there is ~0.7m of wall each side of the ink, and a column standing
 *    proud of a curving wall loses more of that to perspective than the flat
 *    arithmetic suggests.
 *
 * Rendered at the real hero pose before choosing: at 35cm of clearance only a
 * sliver of each column survived the frame edge and they read as a cropping
 * artefact rather than as architecture; at 5cm the whole column showed but
 * crowded the M and T serifs. At `INK_CLEARANCE` 0.22 with a 0.28 shaft, most
 * of each column's proud half is in frame at 4:3 and more at wider aspects,
 * with the frame edge cutting only its outer shoulder, and clear air remains
 * beside the lettering. The inner flank — the side that catches the uplight —
 * is the part that always shows.
 */

/** Shaft radius. The ring's columns are 0.26; a touch heavier, as wall-bearing columns are. */
const SHAFT_RADIUS = 0.28
/** Clear wall between the outermost letter and each column's inner face. */
const INK_CLEARANCE = 0.22
/** Measured half-extent of the wordmark's ink along the wall. */
const INK_HALF_WIDTH = 3.53
/** Same height as the ring: terminating into the vault springing. */
const COLUMN_HEIGHT = 5.9
/**
 * Everything more than this far BEHIND the axis plane is removed. Not zero:
 * the wall itself wanders by up to ~0.15 along its height, so trimming exactly
 * at the axis would open a slit between column and wall wherever the wall bows
 * back. Anything left behind the surface is simply inside the wall.
 */
const TRIM_BEHIND = 0.2
/**
 * Column generator seeds. Both land on the generator's 'intact' condition, and
 * are distinct from the ring's 0-11 so no two columns in the room share a face.
 */
const COLUMN_SEEDS = [21, 22]

/** `LatheGeometry` is always indexed, so only the index needs rewriting. */
function trimBehindWall(geometry) {
  const source = geometry
  const index = source.index
  const position = source.attributes.position
  const kept = []
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i)
    const b = index.getX(i + 1)
    const c = index.getX(i + 2)
    if (position.getZ(a) < -TRIM_BEHIND && position.getZ(b) < -TRIM_BEHIND && position.getZ(c) < -TRIM_BEHIND) continue
    kept.push(a, b, c)
  }
  source.setIndex(kept)
  return source
}

export function buildHeroColumnsGeometry() {
  const axisOffset = INK_HALF_WIDTH + INK_CLEARANCE + SHAFT_RADIUS
  const parts = [-1, 1].map((side, i) => {
    const geometry = trimBehindWall(buildColumnGeometry(COLUMN_HEIGHT, COLUMN_SEEDS[i], SHAFT_RADIUS))
    // On the wall surface at the wordmark's height, where the framing is read.
    const { center, normal } = wallPointAtArc(
      WALL_INSCRIPTION.centerTheta,
      WALL_INSCRIPTION.offsetAlongWall + side * axisOffset,
      WALL_INSCRIPTION.centerY,
    )
    // Local +Z faces into the room, so the kept half is the one that shows.
    geometry.rotateY(Math.atan2(normal[0], normal[2]))
    geometry.translate(center[0], 0, center[2])
    // After placement, so the weathering is sampled where the column stands —
    // the same field and range the ring uses.
    applyStoneMacroVariation(geometry, { seed: 11, range: [0.82, 1.14] })
    return geometry
  })
  return mergeGeometries(parts, false)
}

export const HERO_COLUMN_AXIS_OFFSET = INK_HALF_WIDTH + INK_CLEARANCE + SHAFT_RADIUS
