import { LETTERING_CENTER, TABLE_TOP_CENTER, ZONES } from './studioLayout.js'

/**
 * The six stages of the Creative Table sequence, in order.
 *
 * Everything that changes from one stage to the next is defined here and
 * nowhere else: where the camera stands, what it looks at, its field of view,
 * and how much of each light is up. `stageSampling.js` interpolates between
 * neighbouring stages, so a stage is only ever a resting state — the moves
 * between them are derived, not authored.
 *
 * `lookAt` is also the lens's focus subject: every shot here looks at what it
 * is about.
 *
 * `lights` are levels from 0 to 1 of the fixtures in `studioLayout.js`.
 *
 * `fitTableWidth` marks a stage whose distance is solved per viewport — see
 * `OVERVIEW_FRAMING`.
 *
 * Neighbouring stages must not share an identical `position` or `lookAt`: the
 * path is a spline through them, and a repeated point puts a small loop in it.
 *
 * PROVISIONAL: poses and levels are placeholders for validating the system.
 * They are tuned against the real room in Phase 2 and Phase 3.
 */
/**
 * How much of the viewport's width the table spans in the overview.
 *
 * A fraction of the width cannot be a fixed camera position: the field of view
 * is fixed vertically, so the same position shows the table narrower on a wide
 * window and wider on a narrow one. The overview's `position` therefore gives
 * the DIRECTION the camera views the table from, and `stageSampling.js` solves
 * the distance along it for the live aspect ratio — and the height it aims at,
 * so the table sits centred in the frame rather than low in it.
 *
 * Two things can stop the table reaching this fill. On a very wide window it
 * would outgrow the frame's height first, so `maxHeightFill` wins and the
 * table sits a little narrower. On a narrow one the distance limit, which
 * keeps the camera inside the room, wins. Portrait framing is a Phase 2 task.
 */
export const OVERVIEW_FRAMING = {
  tableWidthFill: 0.75,
  maxHeightFill: 0.8,
  minDistance: 2.2,
  maxDistance: 6.5,
}

const OVERVIEW_CAMERA = { position: [1.35, 3.6, 3.75], lookAt: TABLE_TOP_CENTER, fov: 45, fitTableWidth: true }

export const STAGES = [
  {
    key: 'dim',
    // The wall identity, with the table in the foreground.
    camera: { position: [0, 1.3, 3.6], lookAt: [0, 1.75, LETTERING_CENTER[2]], fov: 45 },
    lights: { ambient: 1, lettering: 0.06, tableKey: 0 },
  },
  {
    key: 'lettering',
    // A subtle push toward the wall as the spotlight comes up.
    camera: { position: [0, 1.4, 2.6], lookAt: LETTERING_CENTER, fov: 45 },
    lights: { ambient: 1, lettering: 1, tableKey: 0 },
  },
  {
    key: 'table',
    // Crane up, tilt down: the whole table from an elevated three-quarter angle.
    camera: OVERVIEW_CAMERA,
    lights: { ambient: 1, lettering: 1, tableKey: 1 },
  },
  {
    key: 'film',
    camera: { position: [-1.25, 1.75, 1.45], lookAt: ZONES.film, fov: 45 },
    lights: { ambient: 1, lettering: 0.55, tableKey: 1 },
  },
  {
    key: 'digital',
    camera: { position: [1.25, 1.75, 1.45], lookAt: ZONES.digital, fov: 45 },
    lights: { ambient: 1, lettering: 0.55, tableKey: 1 },
  },
  {
    key: 'overview',
    // The same view the table was revealed from.
    camera: OVERVIEW_CAMERA,
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
