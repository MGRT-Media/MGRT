/**
 * Where everything in the Creative Table studio is.
 *
 * The single source of the room's dimensions and anchors: the geometry, the
 * lights, the camera's stages (`stageBeats.js`) and the lens all read from
 * here, so the room can be re-proportioned by editing this file alone.
 *
 * Metres. The table stands on the floor at the origin, the rear wall is behind
 * it at negative Z, and the camera works from the positive-Z side — so from
 * the front, Film (negative X) is on the left and Digital on the right.
 */
export const TABLE = {
  width: 3.6,
  depth: 1.8,
  height: 0.78,
  topThickness: 0.06,
  legThickness: 0.09,
  legInset: 0.16,
  // Clear floor between the table's rear edge and the rear wall.
  rearClearance: 1.4,
}

const ROOM_WIDTH = 9
const ROOM_DEPTH = 7
const REAR_WALL_Z = -(TABLE.depth / 2 + TABLE.rearClearance)

export const ROOM = {
  width: ROOM_WIDTH,
  depth: ROOM_DEPTH,
  height: 4,
  rearWallZ: REAR_WALL_Z,
  frontWallZ: REAR_WALL_Z + ROOM_DEPTH,
}

/** The centre of the tabletop's surface. */
export const TABLE_TOP_CENTER = [0, TABLE.height, 0]

/** The whole table, floor to tabletop, as a box: what an overview must show. */
export const TABLE_BOUNDS = {
  center: [0, TABLE.height / 2, 0],
  size: [TABLE.width, TABLE.height, TABLE.depth],
}

// Headroom above the tabletop that a collection's shot must include — a
// cinema camera or a propped-up screen stands this tall.
const COLLECTION_HEIGHT = 0.45

function zone(centerX, width) {
  const depth = 1.5
  return {
    // On the tabletop: where the collection sits, and what its shot aims at.
    center: [centerX, TABLE.height, 0],
    size: [width, depth],
    // The volume its shot has to keep in frame.
    bounds: {
      center: [centerX, TABLE.height + COLLECTION_HEIGHT / 2, 0],
      size: [width, COLLECTION_HEIGHT, depth],
    },
  }
}

/**
 * The three areas of the one tabletop. They are regions of a continuous
 * workspace, not separate displays: nothing is placed on the table until the
 * population phase, and until then these exist only as positions.
 */
export const ZONES = {
  film: zone(-1.2, 1.1),
  mgrt: zone(0, 1.1),
  digital: zone(1.2, 1.1),
}

/**
 * The stacked MGRT / MEDIA wordmark on the rear wall.
 *
 * `lines` is the established setting, carried over from the original scene's
 * wall inscription: Cormorant Medium, each line's share of the block's width,
 * its letter-spacing in ems, and its vertical centre as a fraction of the
 * block's height. `aspect` is that block's width over its height.
 */
export const LETTERING = {
  width: 1.8,
  aspect: 8 / 2.6,
  centerY: 2.5,
  depth: 0.03,
  // The gap between the wall and the back of the letters.
  standoff: 0.02,
  fontFamily: "'Cormorant', Georgia, serif",
  fontWeight: 500,
  lines: [
    { text: 'MGRT', fill: 0.9, tracking: 0.22, baseline: 0.33 },
    { text: 'MEDIA', fill: 0.74, tracking: 0.36, baseline: 0.77 },
  ],
}

export const LETTERING_HEIGHT = LETTERING.width / LETTERING.aspect

export const LETTERING_CENTER = [
  0,
  LETTERING.centerY,
  ROOM.rearWallZ + LETTERING.standoff + LETTERING.depth / 2,
]

/**
 * The fixtures. `intensity` is each light at full; how much of it a stage uses
 * is that stage's `lights` level in `stageBeats.js`.
 *
 * PROVISIONAL: enough light to judge the blockout by. The lighting itself is
 * designed in Phase 3.
 */
export const LIGHTS = {
  ambient: { skyColor: '#8a8580', groundColor: '#2a2826', intensity: 2.6 },
  // Warm architectural spot from the ceiling, raking down the wall.
  lettering: {
    position: [0, ROOM.height - 0.2, ROOM.rearWallZ + 1.5],
    target: LETTERING_CENTER,
    color: '#ffc690',
    intensity: 45,
    angleDegrees: 34,
    penumbra: 0.8,
  },
  // Large soft key over the table, from the Film side. The only shadow caster.
  tableKey: {
    position: [-1.8, ROOM.height - 0.2, 1.6],
    target: TABLE_TOP_CENTER,
    color: '#ffd9b0',
    intensity: 130,
    angleDegrees: 42,
    penumbra: 1,
    shadowMapSize: 2048,
  },
}
