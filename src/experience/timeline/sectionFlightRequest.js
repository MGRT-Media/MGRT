/**
 * The hand-off between the side navigation and the camera rig.
 *
 * `ScrollTimelineProvider` decides WHEN a section flight happens (a click on a
 * section mark) and keeps scroll, locks and chapter state in step with it.
 * `ScrollCameraRig` owns the camera and flies it. The request lives in this
 * import-free module because the provider cannot import the rig's route
 * planning: that pulls in `cameraPath.js`, whose import chain leads back to the
 * provider (see the note on `HERO_T` in `filmActBeats.js`).
 *
 * The rig consumes a request on its next frame.
 */
export const sectionFlightRequest = { pending: null }

/**
 * Fly to the section at `targetT`. `onArrive` runs on the frame the camera
 * settles on the destination; `immediate` skips the travel
 * (prefers-reduced-motion).
 */
export function requestSectionFlight(targetT, { onArrive, immediate = false }) {
  sectionFlightRequest.pending = { targetT, onArrive, immediate }
}

/** Stop a flight where it is and hand the camera back to scroll. */
export function cancelSectionFlight() {
  sectionFlightRequest.pending = { cancel: true }
}
