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
  // The approved footprint and working height: the top surface, edge to edge.
  width: 3.6,
  depth: 1.8,
  height: 0.78,
  // A solid top: a stone slab of this span wants to be substantial.
  topThickness: 0.06,
  // The top's edges are eased, not sharp: this small round along its upper
  // and lower arrises is what catches the key light as a line.
  edgeRadius: 0.004,
  // Its corners, seen from above, are rounded just enough not to cut.
  cornerRadius: 0.014,
  // Square legs, set in from the edges so the top overhangs them: further at
  // the ends than along the sides, which is where people sit and stand.
  // Insets are from the top's edge to the leg's outer face.
  leg: { size: 0.085, endInset: 0.15, sideInset: 0.085 },
  // A plain apron rail between each pair of legs, under the top: what holds a
  // 3.6 m top flat, and what makes the table read as built rather than a slab
  // on posts. Set back a little from the legs' outer faces.
  apron: { height: 0.095, thickness: 0.024, setBack: 0.012 },
  // The ease on every edge of the legs and rails.
  pieceRadius: 0.003,
  // The stone table (`LOOK.tableFinish: 'stone'`). The walnut fields above
  // describe the earlier wooden table, which is kept.
  stone: {
    // A 50 mm slab: enough to read as solid stone without becoming a block.
    thickness: 0.05,
    // Its upper edge is rounded over 9 mm, its lower edge 5 mm: an eased
    // profile that catches the key light as a soft line, not a cut.
    edgeRadius: 0.009,
    underEdgeRadius: 0.005,
    // Corners rounded in plan, as a fabricator would leave a slab this size.
    cornerRadius: 0.045,
    // Two stone pedestals standing across the table, set in from its ends,
    // so the slab overhangs them on every side and the space beneath stays
    // open. Their edges are rounded throughout.
    pedestal: { width: 0.14, depth: 1.0, centerFromEnd: 0.6, radius: 0.025 },
    // Between each pedestal and the slab, a recessed blackened-steel plate:
    // a shadow gap, so the two stones never meet in a hard line.
    reveal: { height: 0.014, inset: 0.022, radius: 0.004 },
  },
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
  // The plaster runs into the floor through a small cove rather than meeting
  // it at a right angle: the radius of that curve. A plasterer's cove, not a
  // photographer's — large enough to soften the line, far too small to hide it.
  coveRadius: 0.08,
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

/** A stretch of the tabletop, with that headroom, as a box a shot can frame. */
function tabletopBounds(centerX, width, depth) {
  return {
    center: [centerX, TABLE.height + COLLECTION_HEIGHT / 2, 0],
    size: [width, COLLECTION_HEIGHT, depth],
  }
}

function zone(centerX, width) {
  const depth = 1.5
  return {
    // On the tabletop: where the collection sits, and what its shot aims at.
    center: [centerX, TABLE.height, 0],
    size: [width, depth],
    // The volume its shot has to keep in frame.
    bounds: tabletopBounds(centerX, width, depth),
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
 * The middle of the tabletop from its rear edge to its near one: what a shot
 * has to hold top to bottom to show the table's full depth, whatever length of
 * the table its width then takes in.
 */
export const TABLE_DEPTH_BOUNDS = tabletopBounds(0, 1.1, TABLE.depth)

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

/** The wordmark as a box, for a shot that has to hold all of it. */
export const LETTERING_BOUNDS = {
  center: LETTERING_CENTER,
  size: [LETTERING.width, LETTERING_HEIGHT, LETTERING.depth],
}

/**
 * The fixtures. `intensity` is each light at full; how much of it a stage uses
 * is that stage's `lights` level in `stageBeats.js`.
 *
 * Three sources carry the room, each one a fixture that could be there: a
 * spot on the wall identity, a key over the table, and the warm light those
 * two throw back off the plaster and the wood. `ambient` is that return, as a
 * dim wash; `fill` is the part of it that comes back off the rear wall onto
 * the table, which is what lets the table's near side and legs keep some shape
 * instead of dropping to black.
 */
export const LIGHTS = {
  ambient: { skyColor: '#54483d', groundColor: '#15110e', intensity: 2.6 },
  // Warm architectural spot from the ceiling, far enough out from the wall
  // that the letters' shadows stay short: a dark edge under each letter that
  // lifts it off the plaster, not a second wordmark printed below the first.
  lettering: {
    position: [0, ROOM.height - 0.2, ROOM.rearWallZ + 2.3],
    target: [0, LETTERING.centerY - 0.45, ROOM.rearWallZ],
    color: '#ffd0a2',
    intensity: 52,
    angleDegrees: 36,
    penumbra: 0.95,
    shadowMapSize: 2048,
  },
  // Large soft key over the table, from the Film side and a little in front.
  tableKey: {
    position: [-1.9, ROOM.height - 0.2, 1.5],
    target: [0.15, TABLE.height, 0],
    color: '#ffdfc0',
    intensity: 165,
    angleDegrees: 44,
    penumbra: 1,
    // Half the lettering spot's resolution on purpose. The shadow filter's
    // softening is a fixed number of map texels, so a coarser map gives the
    // table's shadow a wider edge — closer to what a large, soft source
    // throws — where a fine one cut it out of the floor like a stencil.
    shadowMapSize: 1024,
  },
  // Bounce off the lit wall, back across the table toward the camera.
  fill: {
    position: [0.6, 2.4, ROOM.rearWallZ + 0.4],
    target: [0, TABLE.height, 0.4],
    color: '#ffc08a',
    intensity: 0.8,
  },
}
