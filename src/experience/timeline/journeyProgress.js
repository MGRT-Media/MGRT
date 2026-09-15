import { JOURNEY_END_T } from './filmActBeats.js'

/**
 * Where the camera is along the journey, as the rest of the scene reads it.
 *
 * The journey ends at the MGRT hero (`JOURNEY_END_T`). Scroll may run on past
 * it — a fast gesture's inertia, a keyboard scroll, a rounding pixel — but the
 * camera may not: the progress drawn is clamped there, so the hero stays a
 * stable final frame with nothing beyond it to move toward.
 *
 * Plain mutable state, like `scrollProgress`: read every frame, never React
 * state.
 */

/** Effective progress — what the camera is actually drawn from. */
export const renderedProgress = { value: 0 }

/**
 * Where the camera actually IS along the path this frame: `renderedProgress`
 * after `ScrollCameraRig`'s easing. Anything that has to stay in step with
 * what the viewer sees — rather than with where scroll is heading — reads this.
 */
export const cameraProgress = { value: 0 }

function clampToJourney(progress) {
  return Math.min(Math.max(progress, 0), JOURNEY_END_T)
}

/** Takes this frame's raw scroll progress and returns the progress to draw. */
export function advanceJourney(rawProgress) {
  renderedProgress.value = clampToJourney(rawProgress)
  return renderedProgress.value
}

/**
 * Puts the journey at `progress` directly, so scroll takes over from a section
 * flight (or from an interrupted one) exactly where the camera is.
 */
export function syncJourney(progress) {
  renderedProgress.value = clampToJourney(progress)
}
