/**
 * Where everything in the Creative Table studio is.
 *
 * The single source of the room's dimensions and anchors: the geometry, the
 * lights, the camera's stages (`stageBeats.js`) and the lens all read from
 * here, so the room can be re-proportioned by editing this file alone.
 *
 * Metres. The table stands on the floor at the origin, the back wall is behind
 * it at negative Z, and the camera works from the positive-Z side — so from
 * the overview, Film (negative X) is on the left and Digital on the right.
 *
 * PROVISIONAL: these are blockout proportions for validating framing. They are
 * expected to change in Phase 2.
 */
export const ROOM = {
  width: 9,
  depth: 8,
  backWallZ: -2.6,
  wallHeight: 3.4,
}

export const TABLE = {
  width: 3.0,
  depth: 1.5,
  height: 0.76,
  topThickness: 0.06,
  legThickness: 0.08,
  legInset: 0.14,
}

/** The centre of the tabletop's surface: what the overview looks at. */
export const TABLE_TOP_CENTER = [0, TABLE.height, 0]

/**
 * The three collections' places on the tabletop. Positions only — nothing is
 * placed on the table until the population phase.
 */
export const ZONES = {
  film: [-0.95, TABLE.height, 0],
  mgrt: [0, TABLE.height, 0],
  digital: [0.95, TABLE.height, 0],
}

/** The MGRT / MEDIA wordmark's footprint on the back wall. */
export const LETTERING = {
  width: 3.0,
  height: 1.0,
  depth: 0.03,
  // The gap between the wall and the back of the letters.
  standoff: 0.02,
  centerY: 1.95,
}

export const LETTERING_CENTER = [
  0,
  LETTERING.centerY,
  ROOM.backWallZ + LETTERING.standoff + LETTERING.depth / 2,
]

/**
 * The fixtures. `intensity` is each light at full; how much of it a stage uses
 * is that stage's `lights` level in `stageBeats.js`.
 */
export const LIGHTS = {
  ambient: { skyColor: '#4a3a28', groundColor: '#0b0908', intensity: 1.6 },
  // Warm architectural spot from the ceiling, raking down the wall.
  lettering: {
    position: [0, 3.2, -0.9],
    target: LETTERING_CENTER,
    color: '#ffc690',
    intensity: 30,
    angleDegrees: 32,
    penumbra: 0.8,
  },
  // Large soft key over the table, from the Film side. The only shadow caster.
  tableKey: {
    position: [-1.6, 3.2, 1.4],
    target: TABLE_TOP_CENTER,
    color: '#ffd9b0',
    intensity: 70,
    angleDegrees: 38,
    penumbra: 1,
    shadowMapSize: 2048,
  },
}
