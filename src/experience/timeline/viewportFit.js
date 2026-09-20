import * as THREE from 'three'

/**
 * Fitting a shot's composition inside the viewport — `object-fit: contain`
 * for a perspective camera.
 *
 * Every stationary beat in this experience is a head-on shot of one thing: the
 * wordmark on its wall, the film camera down its own lens axis, the monitor
 * square to its screen. Each was composed against the frame's HEIGHT, which
 * binds on a landscape viewport and on none of the portrait ones — the
 * vertical field is fixed at 45 degrees, so turning a phone upright collapses
 * the horizontal field to about 21 and the sides of the composition fall
 * outside the frame.
 *
 * This solves the other direction too: given what a shot has to show, it
 * returns how far back the camera must stand for all of it to be inside the
 * frame. The shot is otherwise untouched — same axis, same look-at, same
 * orientation — so a narrow viewport gets the same composition, smaller,
 * rather than a cropped one.
 */

/**
 * A composition is a PROFILE: how wide and how tall the subject is at each
 * depth, measured in the shot's own frame.
 *
 * Not a single bounding box, because both props are yawed and neither is a
 * box. The monitor's widest point is its case and its nearest is the keyboard
 * shelf two thirds of a metre in front of the screen; the film camera's is a
 * narrow hood in front of a tall film reel. One box has to carry the widest
 * part at the nearest depth, which stood the camera 25% further back than the
 * shot needs (measured on the monitor: 4.5 units where 3.2 fits it).
 *
 * Each sample is `{ depth, halfWidth, halfHeight }` with depth measured from
 * the shot's look-at target along the view direction — negative toward the
 * camera. The distances the samples ask for are compared and the largest wins,
 * so the binding part of the subject is whichever one it actually is at this
 * aspect.
 */
export function containDistance({ profile, aspect, fovDegrees = 45, margin = 1 }) {
  const halfFovY = THREE.MathUtils.degToRad(fovDegrees / 2)
  // The frustum the composition may use: `margin` of 1.08 keeps an 8% safe
  // area on all four sides, for the browser's own furniture and for rounded
  // phone corners.
  const tanY = Math.tan(halfFovY) / margin
  const tanX = Math.tan(Math.atan(Math.tan(halfFovY) * Math.max(aspect, 0.05))) / margin

  let distance = 0
  for (const { depth, halfWidth, halfHeight } of profile) {
    distance = Math.max(distance, halfWidth / tanX - depth, halfHeight / tanY - depth)
  }
  return distance
}

/**
 * How much of the contain-fit to apply at a given aspect.
 *
 * The approved framing is the baseline and is left alone on the viewports it
 * was composed for; the fit is blended in as the viewport narrows, reaching
 * full strength by 4:3 — the squarest shape in the test matrix that still has
 * to show every composition whole — and holding there for everything
 * narrower. A blend rather than a breakpoint, so a window dragged between the
 * two re-frames continuously and nothing steps at a threshold.
 *
 * At 16:10 and wider this is zero, which is what keeps 1920x1080, 1440x900 and
 * 1280x720 at exactly the framing they were signed off with.
 */
const FIT_ASPECT_NONE = 1.6
const FIT_ASPECT_FULL = 4 / 3

export function fitWeightForAspect(aspect) {
  return 1 - THREE.MathUtils.smoothstep(aspect, FIT_ASPECT_FULL, FIT_ASPECT_NONE)
}

/**
 * The stand-off for a beat: never closer than the approved one, blended toward
 * the contain-fit as the viewport narrows, and capped where the room itself
 * gets in the way (`limit` — the hero's colonnade).
 */
export function framedDistance({ approved, fit, aspect, limit = Infinity }) {
  const blended = THREE.MathUtils.lerp(approved, Math.max(approved, fit), fitWeightForAspect(aspect))
  return Math.min(blended, limit)
}
