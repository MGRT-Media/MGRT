import * as THREE from 'three'

/**
 * The closing frame — the chapter after Campaigns.
 *
 * The camera timeline ends at the billboard (`CAMPAIGNS_REVEAL_T` is 1), and
 * everything that plans camera moves treats that as the end of the journey. So
 * the ending does not extend the camera path. It is its own progress, 0 to 1,
 * layered over the settled Campaigns frame: `ScrollTimelineProvider` moves it
 * with the same forward/backward chapter gestures as every other chapter, and
 * each part of the sequence is a pure function of it, so reversing at any
 * point simply plays the same frames backwards.
 *
 *  - the camera settles a little further onto the billboard (`ScrollCameraRig`);
 *  - the room darkens, edges first, then to a uniform warm charcoal
 *    (`ClosingFrame.jsx`);
 *  - the closing text fades in as the camera comes to rest.
 *
 * Plain mutable state, like `scrollProgress`: read every frame, never React
 * state.
 */
export const endingProgress = {
  value: 0,
  /**
   * Where the closing frame is heading: 1 while it is being entered or shown,
   * or while a flight to it is on its way; 0 otherwise. Written only by
   * `ScrollTimelineProvider` at the moments it starts moving `value` (or sets
   * a flight off towards it), so it is the destination of the one sequence
   * rather than a second state. The side navigation reads it the way it reads
   * `scrollProgress` for every other section: it shows where the visitor is
   * going from the moment they asked to go there.
   */
  target: 0,
}

/** A full forward pass, in seconds. A reverse from part-way takes its share of this. */
export const ENDING_SECONDS = 2.6

/**
 * Leaving the ending by navigating somewhere else. Quicker than scrolling back
 * through it: the destination is the point, and the flight starts at once.
 */
export const ENDING_EXIT_SECONDS = 0.9

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Under reduced motion the ending is a fade and nothing moves: no camera settle,
 * and a short cross-fade instead of the full pacing.
 */
export const ENDING_REDUCED_MOTION_SECONDS = 0.5

/**
 * How far the camera eases toward the billboard, in world units along its own
 * view direction. The exterior frame is ~29 units from the wall, so this is
 * under 2% of the distance: a settle, not another move.
 */
const CAMERA_SETTLE_DISTANCE = prefersReducedMotion ? 0 : 0.45

/** Camera push-in for ending progress `e`, finished by the time the room is dark. */
export function endingCameraSettle(e) {
  return CAMERA_SETTLE_DISTANCE * THREE.MathUtils.smoothstep(e, 0, 0.75)
}

/**
 * The darkening, in two overlapping parts, plus the text.
 *
 * `edges` darkens the frame from the outside in, so for a moment the lit centre
 * of the billboard — stone and light — is all that is left. `uniform` then
 * closes over it into one flat colour. The text starts while that is still
 * finishing, so there is never an empty dark screen to wait through.
 */
export function endingLayers(e) {
  return {
    edges: THREE.MathUtils.smoothstep(e, 0, 0.45),
    uniform: THREE.MathUtils.smoothstep(e, 0.2, 0.75),
    text: THREE.MathUtils.smoothstep(e, 0.6, 1),
  }
}

/** The uniform layer is opaque: nothing of the scene can be seen. */
export function isEndingCovered() {
  return endingProgress.value >= 0.75
}

/** Far enough in that the closing text is readable and its links can be used. */
export function isEndingInteractive() {
  return endingProgress.value >= 0.9
}
