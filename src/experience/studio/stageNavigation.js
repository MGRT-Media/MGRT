import { cameraProgress, renderedProgress } from '../timeline/journeyProgress.js'
import { LAST_STAGE } from './stageBeats.js'

/**
 * Which stage the visitor has asked for.
 *
 * The request is a whole stage number held in `renderedProgress`; the camera's
 * actual, in-between position is `cameraProgress`, which `StudioCameraRig`
 * moves toward the request. They are the two progress values the rest of the
 * experience already reads (`contentProgress.js`), used here in stage units
 * and without the original journey's own clamp.
 *
 * Nothing here knows about input: `StageInput` turns gestures into these
 * calls, and anything else that should move the camera — navigation, later —
 * calls them too.
 */
export function goToStage(index) {
  renderedProgress.value = Math.min(Math.max(Math.round(index), 0), LAST_STAGE)
}

export function stepStage(direction) {
  goToStage(renderedProgress.value + direction)
}

/** Back to the opening, with the camera already there. */
export function resetStages() {
  renderedProgress.value = 0
  cameraProgress.value = 0
}

if (import.meta.env.DEV) {
  // Dev-only handle, matching `window.__sp` and `window.__lights` elsewhere.
  window.__stages = {
    goToStage,
    stepStage,
    state: () => ({ requested: renderedProgress.value, camera: cameraProgress.value }),
  }
}
