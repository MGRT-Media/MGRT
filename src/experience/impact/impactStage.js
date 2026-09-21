import * as THREE from 'three'
import { containDistance, framedDistance } from '../timeline/viewportFit.js'

/**
 * The Impact set: a creative-direction table, and the camera move that
 * discovers it.
 *
 * The journey ends on the MGRT wordmark, head-on, filling the frame. Impact
 * begins by pulling back from that shot — and what the visitor is actually
 * pulling back from turns out to be a PRINT of it, lying on a working table.
 *
 * The whole illusion rests on one fact: at the moment the move starts, the
 * frame is entirely filled by the hero shot and nothing else. So the set is
 * arranged around that single frame.
 *
 *  - The print is a flat sheet carrying a still of the live hero frame,
 *    captured at that instant (`heroPlate.js`).
 *  - It is sized to be EXACTLY the hero frame: the camera's first Impact pose
 *    sees the sheet edge to edge, with the same picture on it. Nothing about
 *    the image changes, so the handoff from the room to the set is not
 *    something the eye has anything to detect.
 *  - The camera then rises off the sheet and tips over, and the sheet becomes
 *    an object on a table rather than the world.
 *
 * Because the sheet is the hero frame, its SHAPE is the viewport's shape: a
 * landscape sheet on a desktop, a tall one on a phone. That is the honest
 * consequence of it being a print of what the visitor was just looking at, and
 * it is what keeps the handoff exact at every aspect rather than only at the
 * one it was authored on.
 *
 * ---
 *
 * The stage's own frame, which everything below is written in:
 *
 *   origin  the centre of the print, on the table's top surface
 *   +X      the print's right — the picture's right
 *   -Z      the print's top  — the picture's up
 *   +Y      the print's face normal: up, because it is lying on a table
 *
 * The stage is placed in the world so that its first camera pose lands on
 * EXACTLY the hero camera's position. That is not decoration: the camera's
 * position is continuous across the handoff, so the path's arc-length table
 * (`cameraPath.js`) stays continuous too and the rig's distance-damped motion
 * carries straight through. Only the view DIRECTION turns, and that turn is
 * invisible because the picture in the frame does not change.
 */

/* ------------------------------------------------------------------ */
/* The table                                                          */
/* ------------------------------------------------------------------ */

/**
 * A creative director's working table, in metres.
 *
 * Sized from what it has to hold rather than from a furniture catalogue: three
 * content clusters with real air between them (see `ZONES`), at a print size
 * that can still be read across a room. 3 x 1.7 is a big studio worktable —
 * two people either side of it — and it is the smallest surface that takes
 * three ~0.8m clusters without them touching.
 */
export const TABLE = {
  width: 3.0,
  depth: 1.7,
  /** Top surface height above the Impact set's floor. */
  height: 0.76,
  /** A worktable top, not a desk's veneer panel. */
  thickness: 0.055,
  /** Square legs, inset from the corners so the top reads as a slab. */
  legThickness: 0.075,
  legInset: 0.16,
}

/**
 * Where each section's material will eventually sit, as (x, z) on the table
 * top — the layout the brief sketches: Hero upper-left, Film out to the
 * right, Digital nearer the viewer on the left.
 *
 * Nothing is drawn for these yet and nothing marks them out; they exist so
 * that the composition this phase settles on is one that HAS room for them,
 * rather than one that has to be re-framed later to make space. The only
 * cluster that exists at all right now is the hero print.
 */
export const ZONES = {
  hero: { x: -0.82, z: -0.30, span: 0.95 },
  film: { x: 0.86, z: -0.10, span: 0.95 },
  digital: { x: -0.42, z: 0.48, span: 0.85 },
}

/**
 * The print's longest side, in metres — a little over A1.
 *
 * Large enough to be the table's anchor and to stay readable at the final
 * stand-off, small enough that the two reserved zones beside it are still
 * obviously empty space rather than margins.
 */
const PRINT_SPAN = 0.92

/** Paper, not card: enough thickness to catch the light along an edge. */
export const PRINT_THICKNESS = 0.0012

/* ------------------------------------------------------------------ */
/* The camera move                                                    */
/* ------------------------------------------------------------------ */

/**
 * The angle the move ends at, measured up from the table's surface.
 *
 * Inside the brief's 35-55 degree band and deliberately nearer the top of it:
 * a three-quarter overhead reads as a working table seen by someone standing
 * over it, while the flatter end of the band starts to read as a still life.
 * It also keeps the far edge of the table inside the frame without having to
 * stand the camera off so far that the print stops being legible.
 */
const END_ELEVATION_DEGREES = 48

/**
 * How far over the camera tips on a tall viewport.
 *
 * The table is a wide, shallow object. Seen from 48 degrees in a portrait
 * frame it fits easily — the contain-fit sees to that — but it fits into the
 * WIDTH and leaves most of the height empty. Standing more over it turns more
 * of the table's depth toward the lens, so the same table covers more of a
 * tall frame without the camera having to come any closer.
 *
 * 55 is the top of the band the brief asks for (35-55), and deliberately not
 * past it: further over and the shot stops reading as someone standing at a
 * table and starts reading as a plan view, which is the one thing a
 * three-quarter overhead is chosen to avoid.
 */
const END_ELEVATION_TALL_DEGREES = 55
const ELEVATION_ASPECT_WIDE = 1.2
const ELEVATION_ASPECT_TALL = 0.62

function endElevationForAspect(aspect) {
  const tall = 1 - THREE.MathUtils.smoothstep(aspect, ELEVATION_ASPECT_TALL, ELEVATION_ASPECT_WIDE)
  return THREE.MathUtils.lerp(END_ELEVATION_DEGREES, END_ELEVATION_TALL_DEGREES, tall)
}

/**
 * When the camera starts to tip over, as a fraction of the move.
 *
 * Nothing about the view angle changes before this: the first third is a pure
 * pull-back along the print's own normal, which is what keeps the illusion.
 * The frame is still the picture, only smaller, and the only new information
 * is the sheet's own edge arriving — which is the intended moment of doubt,
 * not the answer to it.
 */
const TILT_START = 0.30

/**
 * The field of view settles back to the project's own 45 over the first half
 * of the move.
 *
 * The hero opens its field on a narrow viewport (up to 84 degrees, see
 * `heroFovForAspect`) because that is the only way to show the wordmark whole
 * through the colonnade. The table has no such constraint and wants the
 * normal lens. Changing the field while ONLY THE PRINT is in frame is free:
 * the print is flat and square to the camera, so a field change moves nothing
 * but its scale — and `fillDistance` below cancels even that, by standing the
 * camera off exactly far enough to keep the sheet filling the frame. By the
 * time there is any depth in shot to be distorted, the lens is back to 45.
 */
const FOV_SETTLE_END = 0.5
const IMPACT_FOV = 45

/**
 * The stand-off the composition was approved at on a landscape viewport, and
 * the safe area the contain-fit keeps around the table on narrower ones.
 */
const APPROVED_END_DISTANCE = 2.62
const FIT_MARGIN = 1.08

/**
 * The shape of the pull-back.
 *
 * `smootherstep` squared. The square is the whole point: the plain curve is
 * already slow off the mark, but not slow enough to hold a frame that has to
 * stay indistinguishable from the shot before it — at a fifth of the way in it
 * had already given up a quarter of the frame to the sheet's surroundings.
 * Squared, the first quarter of the move costs under 2% of the distance, so
 * the picture is still the picture; the edge then arrives over the second
 * quarter, and the table follows. Both ends still leave and arrive at zero
 * velocity, which is what the square preserves and a plain power curve would
 * not.
 */
function revealEase(u) {
  const s = u * u * u * (u * (u * 6 - 15) + 10)
  return s * s
}

/* ------------------------------------------------------------------ */
/* Stage placement — solved once per viewport, before the move starts  */
/* ------------------------------------------------------------------ */

/**
 * Everything the move and the meshes need, solved together.
 *
 * Re-solved by `syncStage` whenever the hero framing moves, and then FROZEN
 * for as long as the set is on screen (`freezeStage`). That freeze is what
 * makes the print a physical object: resize the window while standing over
 * the table and the camera re-fits, exactly as it does at every other beat,
 * but the sheet on the table does not change size, because sheets do not.
 */
export const stage = {
  /** World transform of the stage's own frame. */
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  /** The print, in metres. */
  printWidth: PRINT_SPAN,
  printHeight: PRINT_SPAN,
  /** Camera height above the print at the handoff — where it fills the frame. */
  handoffDistance: 1,
  /** Stand-off for the final composition, solved for the viewport. */
  endDistance: APPROVED_END_DISTANCE,
  /** How far over the camera stands at the end, in degrees above the table. */
  endElevation: END_ELEVATION_DEGREES,
  /** The field the hero handed over at, so the move can settle back from it. */
  handoffFov: IMPACT_FOV,
  /** Camera-to-subject distance for the pose last sampled — what focus follows. */
  aimDistance: 1,
  /** How far the pull-back has actually TRAVELLED, 0..1 (not raw progress). */
  travelled: 0,
  /** Bumped whenever the placement changes, so the meshes know to re-read it. */
  revision: 0,
}

let frozen = false

const UP = new THREE.Vector3(0, 1, 0)

/** The table's centre, in the stage's own frame (the print sits off to one side). */
const tableCenterLocal = new THREE.Vector3(-ZONES.hero.x, 0, -ZONES.hero.z)

/** Half the frame's height at distance 1, for a given vertical field. */
function halfFrameAt(fovDegrees) {
  return Math.tan(THREE.MathUtils.degToRad(fovDegrees) / 2)
}

/** How far back the print exactly fills the frame, at a given field. */
function fillDistance(fovDegrees) {
  return stage.printHeight / 2 / halfFrameAt(fovDegrees)
}

/**
 * The contain-fit for the finished composition.
 *
 * Built from the real corners of what has to be in shot — the table slab and
 * the print on it — resolved into the END shot's own basis, which is the only
 * frame the fit means anything in. Same construction as every other beat's
 * profile (`viewportFit.js`): each corner contributes how far off-axis it sits
 * and at what depth, and the corner that needs the most room wins.
 */
const fitCorner = new THREE.Vector3()
function endFitDistance(aspect) {
  const elevation = THREE.MathUtils.degToRad(stage.endElevation)
  // The shot's basis: the camera stands off in +Z/+Y and looks back down.
  const forward = new THREE.Vector3(0, -Math.sin(elevation), -Math.cos(elevation))
  const up = new THREE.Vector3(0, Math.cos(elevation), -Math.sin(elevation))
  const right = new THREE.Vector3(1, 0, 0)

  const halfW = TABLE.width / 2
  const halfD = TABLE.depth / 2
  const profile = []
  const add = (x, y, z) => {
    fitCorner.set(x, y, z).sub(tableCenterLocal)
    profile.push({
      depth: fitCorner.dot(forward),
      halfWidth: Math.abs(fitCorner.dot(right)),
      halfHeight: Math.abs(fitCorner.dot(up)),
    })
  }
  // The slab, top and bottom — the table's own silhouette is what frames the
  // shot, and its near bottom edge is the corner closest to the lens.
  for (const x of [-halfW, halfW]) {
    for (const z of [-halfD, halfD]) {
      add(x + tableCenterLocal.x, 0, z + tableCenterLocal.z)
      add(x + tableCenterLocal.x, -TABLE.thickness, z + tableCenterLocal.z)
    }
  }
  // The print, which must never be the thing that gets clipped.
  for (const x of [-stage.printWidth / 2, stage.printWidth / 2]) {
    for (const z of [-stage.printHeight / 2, stage.printHeight / 2]) add(x, 0, z)
  }
  return containDistance({ profile, aspect, fovDegrees: IMPACT_FOV, margin: FIT_MARGIN })
}

/**
 * Places the stage for the current viewport and hero pose.
 *
 * `heroPosition` is where the hero camera rests and `heroAxis` is the
 * direction it stands off the wall in — both already solved for this viewport
 * by `cameraPath.js`, which is the point: the Impact anchors are derived from
 * the SAME responsive framing everything else uses, before the move begins,
 * so the move goes straight to its final target and has nothing to correct on
 * arrival.
 */
export function syncStage({ aspect, heroFov, heroPosition, heroAxis }) {
  if (frozen) return

  // The print is the hero frame, so its shape is the frame's shape; its size
  // is whatever makes the longer side `PRINT_SPAN`.
  const tall = aspect < 1
  stage.printWidth = tall ? PRINT_SPAN * aspect : PRINT_SPAN
  stage.printHeight = tall ? PRINT_SPAN : PRINT_SPAN / aspect
  stage.handoffFov = heroFov
  stage.handoffDistance = fillDistance(heroFov)
  // Solved before the fit, which reads it: the angle changes what has to be
  // fitted into the frame.
  stage.endElevation = endElevationForAspect(aspect)
  stage.endDistance = framedDistance({
    approved: APPROVED_END_DISTANCE,
    fit: endFitDistance(aspect),
    aspect,
  })

  // The table lies flat, directly under the hero camera, so the first Impact
  // pose IS the hero pose. Its yaw follows the hero's own axis — invisible
  // (the room is not on screen by then) but it keeps the set's orientation
  // derived rather than arbitrary.
  stage.position.copy(heroPosition).addScaledVector(UP, -stage.handoffDistance)
  stage.quaternion.setFromAxisAngle(UP, Math.atan2(heroAxis.x, heroAxis.z))
  stage.revision += 1
}

/**
 * Holds the set still.
 *
 * Taken for as long as the camera is anywhere past the hero, so a resize
 * re-frames the shot without resizing the furniture. Released on the way back,
 * at which point the next approach re-solves everything for whatever the
 * viewport has become.
 */
export function freezeStage(next) {
  frozen = next
}

/* ------------------------------------------------------------------ */
/* The pose                                                           */
/* ------------------------------------------------------------------ */

/** The field of view at `u`, settling from the hero's back to the project's own. */
export function impactFov(u) {
  return THREE.MathUtils.lerp(
    stage.handoffFov,
    IMPACT_FOV,
    THREE.MathUtils.smoothstep(u, 0, FOV_SETTLE_END),
  )
}

const localPosition = new THREE.Vector3()
const localTarget = new THREE.Vector3()
const localUp = new THREE.Vector3()
const localOffset = new THREE.Vector3()

/**
 * Writes the camera's world pose for `u` in 0..1 across the Impact move.
 *
 * One continuous move, three overlapping things happening in it: the camera
 * backs off the sheet the whole way, it tips from square-on to the finished
 * three-quarter angle over the last two thirds, and its aim drifts from the
 * print to the table's centre alongside the tip. An explicit up vector comes
 * out with the pose because the first half of this move looks straight down,
 * where a world-up `lookAt` has no answer.
 */
export function impactPoseInto(u, outPosition, outTarget, outUp) {
  const clamped = THREE.MathUtils.clamp(u, 0, 1)
  const settle = THREE.MathUtils.smoothstep(clamped, TILT_START, 1)
  const elevation = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(90, stage.endElevation, settle))
  const sin = Math.sin(elevation)
  const cos = Math.cos(elevation)

  // Distance: from "the sheet exactly fills the frame at the field currently
  // in force" out to the fitted stand-off. Taking the fill distance for the
  // LIVE field rather than a fixed number is what lets the lens settle back
  // to 45 during the illusion without the picture appearing to zoom.
  const travelled = revealEase(clamped)
  const distance = THREE.MathUtils.lerp(fillDistance(impactFov(clamped)), stage.endDistance, travelled)
  stage.aimDistance = distance
  stage.travelled = travelled

  localTarget.set(0, 0, 0).lerp(tableCenterLocal, settle)
  localPosition.copy(localTarget).addScaledVector(localOffset.set(0, sin, cos), distance)
  localUp.set(0, cos, -sin)

  outPosition.copy(localPosition).applyQuaternion(stage.quaternion).add(stage.position)
  outTarget.copy(localTarget).applyQuaternion(stage.quaternion).add(stage.position)
  outUp.copy(localUp).applyQuaternion(stage.quaternion)
}
