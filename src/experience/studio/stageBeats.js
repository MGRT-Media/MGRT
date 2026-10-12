import { ROOM, TABLE_BOUNDS, TABLE_TOP_CENTER, ZONES } from './studioLayout.js'

/**
 * The six stages of the Creative Table sequence, in order.
 *
 * Everything that changes from one stage to the next is defined here and
 * nowhere else: where the camera stands, what it looks at, its field of view,
 * and how much of each light is up. `stageSampling.js` interpolates between
 * neighbouring stages, so a stage is only ever a resting state — the moves
 * between them are derived, not authored.
 *
 * A stage's camera is one of two kinds:
 *
 * - **Fixed.** `position` and `lookAt` are used as written.
 * - **Fitted** (`fit`). The shot is defined by what it must show rather than
 *   by where the camera stands: `position` gives only the DIRECTION the
 *   subject is viewed from, and `stageFraming.js` solves the distance, the aim
 *   and if need be the field of view for the live viewport. `portraitPosition`
 *   is the direction used instead on an upright screen.
 *
 * `lookAt` is also the lens's focus subject: every shot here looks at what it
 * is about.
 *
 * `lights` are levels from 0 to 1 of the fixtures in `studioLayout.js`.
 *
 * Neighbouring stages must not share an identical `position` or `lookAt`: the
 * path is a spline through them, and a repeated point puts a small loop in it.
 */

/**
 * How fitted shots are framed.
 *
 * The subject is brought as close as it can be while spanning no more than
 * `widthFill` of the frame's width and `heightFill` of its height (a stage may
 * set its own). The camera never leaves the room: `roomMargin` is the nearest
 * it comes to a wall or the ceiling. If the room is too small for the shot at
 * the stage's own field of view — a narrow window, or the ceiling over the
 * near-overhead view — the lens widens instead, only as far as the shot needs
 * and never past `maxFov`. Beyond that the subject is allowed to crop.
 */
export const FRAMING = {
  widthFill: 0.75,
  heightFill: 0.8,
  maxFov: 58,
  minDistance: 1.2,
  roomMargin: 0.25,
}

/** Below this aspect ratio a stage's `portraitPosition` is used, if it has one. */
export const PORTRAIT_ASPECT = 0.9

const rearWallZ = ROOM.rearWallZ

export const STAGES = [
  {
    key: 'dim',
    // The wall identity, low and square-on, with the table a silhouette across
    // the foreground.
    camera: { position: [0, 1.22, 4.3], lookAt: [0, 1.75, rearWallZ], fov: 40 },
    lights: { ambient: 1, lettering: 0.08, tableKey: 0 },
  },
  {
    key: 'lettering',
    // A subtle push toward the wall as the spotlight comes up. Stops short of
    // losing the table's near edge out of the bottom of the frame.
    camera: { position: [0, 1.3, 3.7], lookAt: [0, 1.9, rearWallZ], fov: 40 },
    lights: { ambient: 1, lettering: 1, tableKey: 0 },
  },
  {
    key: 'table',
    // Crane up, tilt down: the whole table from an elevated three-quarter
    // angle, the rear wall still in the top of the frame.
    camera: {
      position: [1.25, 3.3, 3.9],
      // From beyond the Digital end, looking down the table's length.
      portraitPosition: [3.6, 3.3, 1.3],
      lookAt: TABLE_TOP_CENTER,
      fov: 45,
      fit: { bounds: TABLE_BOUNDS },
    },
    lights: { ambient: 1, lettering: 1, tableKey: 1 },
  },
  {
    key: 'film',
    // In over the left of the table.
    camera: {
      position: [ZONES.film.center[0] - 0.4, 2.55, 2.0],
      lookAt: ZONES.film.center,
      fov: 45,
      fit: { bounds: ZONES.film.bounds, widthFill: 0.7, heightFill: 0.7 },
    },
    lights: { ambient: 1, lettering: 0.55, tableKey: 1 },
  },
  {
    key: 'digital',
    // Across the table to the right, at the same height.
    camera: {
      position: [ZONES.digital.center[0] + 0.4, 2.55, 2.0],
      lookAt: ZONES.digital.center,
      fov: 45,
      fit: { bounds: ZONES.digital.bounds, widthFill: 0.7, heightFill: 0.7 },
    },
    lights: { ambient: 1, lettering: 0.55, tableKey: 1 },
  },
  {
    key: 'overview',
    // Higher and nearly overhead: the complete table with little distortion.
    // A touch off vertical, so the camera still has a floor to stand over.
    camera: {
      position: [0, 4, 0.55],
      // The ceiling is too low to hold the table's length from overhead on an
      // upright screen, so this is a steep view down its length instead.
      portraitPosition: [3.3, 4.4, 0],
      lookAt: TABLE_TOP_CENTER,
      fov: 45,
      fit: { bounds: TABLE_BOUNDS, widthFill: 0.8, heightFill: 0.8 },
    },
    lights: { ambient: 1, lettering: 1, tableKey: 1 },
  },
]

export const LAST_STAGE = STAGES.length - 1

/**
 * How long the camera takes to travel one stage, approximately: the smoothing
 * time of the spring in `StudioCameraRig`. Lighting rides the same progress, so
 * this paces both.
 */
export const STAGE_TRAVEL_SECONDS = 0.45
