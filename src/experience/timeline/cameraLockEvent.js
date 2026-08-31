/**
 * A small, reusable pub/sub for "the camera has reached the end of the
 * scroll trajectory" (and its reverse) — framework-agnostic, matching this
 * codebase's established pattern of plain mutable module state rather than
 * React state for scroll-driven values (technical-architecture.md §7).
 *
 * `updateCameraLockState(progress)` is called once per frame from
 * `ScrollCameraRig.jsx` (which already reads `scrollProgress.value` every
 * frame for the camera itself) and fires the registered callbacks exactly
 * once on each state transition — not every frame while sitting at the
 * threshold. `LOCK_THRESHOLD` is just short of 1 (not exactly 1) so it
 * reliably fires once the camera has visibly settled into the monitor-
 * locked shot, without depending on floating-point progress ever hitting
 * exactly 1.0.
 *
 * Both directions are exposed (not just `onCameraLock`) so consumers can
 * cleanly reset themselves when the visitor scrolls back out — this
 * project's scroll is deterministic/reversible by design, and a one-way
 * "lock" event with no reverse would break that for anything hooked to it
 * (see `Monitor.jsx`'s own screen-ignite listener for the concrete case).
 */
const LOCK_THRESHOLD = 0.995

let locked = false
const lockListeners = new Set()
const unlockListeners = new Set()

/** Registers a callback for when the camera reaches the monitor lock. Returns an unsubscribe function. */
export function onCameraLock(callback) {
  lockListeners.add(callback)
  return () => lockListeners.delete(callback)
}

/** Registers a callback for when the camera leaves the monitor lock (scrolls back below the threshold). */
export function onCameraUnlock(callback) {
  unlockListeners.add(callback)
  return () => unlockListeners.delete(callback)
}

export function updateCameraLockState(progress) {
  if (progress >= LOCK_THRESHOLD && !locked) {
    locked = true
    lockListeners.forEach((callback) => callback())
  } else if (progress < LOCK_THRESHOLD && locked) {
    locked = false
    unlockListeners.forEach((callback) => callback())
  }
}
