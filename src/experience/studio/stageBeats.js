import { LETTERING_BOUNDS, ROOM, TABLE_BOUNDS, TABLE_DEPTH_BOUNDS, TABLE_TOP_CENTER, ZONES } from './studioLayout.js'

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
 *   and if need be the field of view for the live viewport.
 *
 * `portrait` holds whatever a stage changes on an upright screen; its fields
 * replace the camera's own there. The whole table cannot span a phone's width
 * from inside the room, so the portrait shots keep the desktop's viewing angle
 * — Film on the left, Digital on the right — and frame a deliberate crop of
 * the workspace instead of forcing all of it in.
 *
 * A fitted shot's `bounds` may be a list of boxes, framed together. The
 * portrait table shots use that to hold the whole wordmark above the table: a
 * tall frame has height to spare once the table's width is set, and spent on
 * the wall it shows the lettering complete, where spent on the floor it shows
 * nothing and cuts the lettering in half at the top edge.
 *
 * `lookAt` is also the lens's focus subject: every shot here looks at what it
 * is about.
 *
 * `lights` are levels of the fixtures in `studioLayout.js`: 0 is off and 1 is
 * the fixture at its designed strength.
 *
 * Neighbouring stages must not share an identical `position` or `lookAt`: the
 * path is a spline through them, and a repeated point puts a small loop in it.
 */

/**
 * How fitted shots are framed.
 *
 * The subject is brought as close as it can be while spanning no more than
 * `widthFill` of the frame's width and `heightFill` of its height (a stage may
 * set its own), and centred — or, with a stage's `centerY`, set lower in the
 * frame, which trades empty floor under the table for wall above it. The
 * camera never leaves the room: `roomMargin` is the nearest
 * it comes to a wall or the ceiling. If the room is too small for the shot at
 * the stage's own field of view — a narrow window, or the ceiling over the
 * near-overhead view — the lens widens instead, only as far as the shot needs
 * and never past `maxFov`. Beyond that the subject is allowed to crop.
 */
export const FRAMING = {
  widthFill: 0.75,
  heightFill: 0.8,
  maxFov: 58,
  // The top of every shot is wall: no sight line may land on the rear or side
  // walls nearer the ceiling than this, which keeps the ceiling, its junction
  // with the walls and the fixtures hung from it out of frame. Fixed shots are
  // authored to respect it; any shot that does not is tilted down until it does.
  ceilingClearance: 0.15,
  minDistance: 1.2,
  roomMargin: 0.25,
}

/** Below this aspect ratio a stage's `portrait` framing is used, if it has one. */
export const PORTRAIT_ASPECT = 0.9

const rearWallZ = ROOM.rearWallZ

// Roughly midway between the wordmark and the table's near edge: where the
// portrait table shots start aiming before the solver centres them.
const PORTRAIT_TABLE_AIM = [0, 1.8, -0.8]

export const STAGES = [
  {
    key: 'dim',
    // The wall identity, low and square-on, with the table a silhouette across
    // the foreground.
    camera: {
      position: [0, 1.22, 4.3],
      lookAt: [0, 1.4, rearWallZ],
      fov: 40,
      // Lower on an upright screen: the frame's extra height then ends at the
      // table's feet instead of running on down an empty floor.
      portrait: { position: [0, 1.05, 4.3], lookAt: [0, 1.42, rearWallZ] },
    },
    lights: { ambient: 0.8, lettering: 0.12, tableKey: 0, fill: 0 },
  },
  {
    key: 'lettering',
    // A subtle push toward the wall as the spotlight comes up. Stops short of
    // losing the table's near edge out of the bottom of the frame.
    camera: {
      position: [0, 1.3, 3.7],
      lookAt: [0, 1.6, rearWallZ],
      fov: 40,
      portrait: { position: [0, 1.12, 3.7], lookAt: [0, 1.57, rearWallZ] },
    },
    // A little more of the spot's return than stage 0, so the walls around
    // the pool are dark but still read as walls.
    lights: { ambient: 1.5, lettering: 1, tableKey: 0, fill: 0.25 },
  },
  {
    key: 'table',
    // Crane up, tilt down: the whole table from an elevated three-quarter
    // angle, the rear wall still in the top of the frame.
    camera: {
      position: [1.25, 3.3, 3.9],
      lookAt: TABLE_TOP_CENTER,
      fov: 45,
      fit: { bounds: TABLE_BOUNDS },
      // The centre of the table under the whole wordmark: the MGRT area
      // prominent, Film and Digital running off the left and right edges.
      // Nearer square-on than the desktop angle, so the lettering sits over
      // the table rather than off to one side, and from further back and
      // lower: the shot now reaches up the wall, and a camera this far from
      // its subject has to stay under the ceiling.
      portrait: {
        position: [0.5, 3.3, 4.3],
        lookAt: PORTRAIT_TABLE_AIM,
        fit: { bounds: [LETTERING_BOUNDS, ZONES.mgrt.bounds], widthFill: 0.9, heightFill: 0.86, centerY: -0.08 },
      },
    },
    lights: { ambient: 1, lettering: 0.85, tableKey: 1, fill: 1 },
  },
  {
    key: 'film',
    // In over the left of the table.
    camera: {
      position: [ZONES.film.center[0] - 0.4, 2.55, 2.0],
      lookAt: ZONES.film.center,
      fov: 45,
      fit: { bounds: ZONES.film.bounds, widthFill: 0.7, heightFill: 0.7 },
      // Lower than the desktop angle, so the longer throw an upright screen
      // needs stays under the ceiling.
      portrait: {
        position: [ZONES.film.center[0] - 0.4, 2.25, 2.3],
        fit: { bounds: ZONES.film.bounds, widthFill: 0.95, heightFill: 0.6, centerY: -0.12 },
      },
    },
    lights: { ambient: 1, lettering: 0.6, tableKey: 1, fill: 1 },
  },
  {
    key: 'digital',
    // Across the table to the right, at the same height.
    camera: {
      position: [ZONES.digital.center[0] + 0.4, 2.55, 2.0],
      lookAt: ZONES.digital.center,
      fov: 45,
      fit: { bounds: ZONES.digital.bounds, widthFill: 0.7, heightFill: 0.7 },
      portrait: {
        position: [ZONES.digital.center[0] + 0.4, 2.25, 2.3],
        fit: { bounds: ZONES.digital.bounds, widthFill: 0.95, heightFill: 0.6, centerY: -0.12 },
      },
    },
    lights: { ambient: 1, lettering: 0.6, tableKey: 1, fill: 1 },
  },
  {
    key: 'overview',
    // Higher and nearly overhead: the complete table with little distortion.
    // A touch off vertical, so the camera still has a floor to stand over.
    camera: {
      position: [0, 4, 0.55],
      lookAt: TABLE_TOP_CENTER,
      fov: 45,
      fit: { bounds: TABLE_BOUNDS, widthFill: 0.8, heightFill: 0.8 },
      // Higher, steeper and on a wider lens than the table reveal: the
      // tabletop seen more from above, under the whole wordmark. The frame is
      // fitted top to bottom — wordmark to the table's near edge — so none of
      // its height goes to floor or ceiling, and its width is whatever that
      // leaves: most of the table on a tablet, the middle of it on a phone.
      // (`TABLE_DEPTH_BOUNDS` is narrow, so the width limit only ever acts to
      // keep the wordmark inside the frame.)
      portrait: {
        // Only just off the room's centre line: this close, any more of an
        // angle swings the wordmark out of the side of a phone's frame.
        position: [0.15, 4.3, 2.6],
        lookAt: PORTRAIT_TABLE_AIM,
        fov: 56,
        // Set a little low, which keeps the wordmark clear of the site's own
        // mark and menu across the top of the screen.
        fit: { bounds: [LETTERING_BOUNDS, TABLE_DEPTH_BOUNDS], widthFill: 0.96, heightFill: 0.87, centerY: -0.07 },
      },
    },
    lights: { ambient: 1.2, lettering: 0.7, tableKey: 1, fill: 1.3 },
  },
]

export const LAST_STAGE = STAGES.length - 1

/**
 * How long the camera takes to travel one stage, approximately: the smoothing
 * time of the spring in `StudioCameraRig`. Lighting rides the same progress, so
 * this paces both.
 */
export const STAGE_TRAVEL_SECONDS = 0.45
