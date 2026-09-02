/**
 * A small, reusable pub/sub for "the visitor clicked a side-navigation mark
 * and wants the camera to jump to that cinematic state" — matching this
 * codebase's established pattern (`scrollLockEvent.js`) of
 * plain mutable module state rather than a parallel React state manager.
 *
 * `SectionIndicator.jsx` is the only writer (`requestNavigate`).
 * `ScrollTimelineProvider.jsx` is the only reader — it already owns the
 * scroll/lock/rate-cap state machine, so navigation requests are handed to
 * it rather than driving `scrollProgress` from here directly, per explicit
 * request to integrate into the existing state engine instead of building a
 * second one.
 */
const listeners = new Set()

/** Registers a callback for direct-navigation requests. Returns an unsubscribe function. */
export function onNavigateRequest(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

/** Requests a direct camera jump to one of SECTION_TARGETS' keys (see filmActBeats.js). */
export function requestNavigate(sectionKey) {
  listeners.forEach((callback) => callback(sectionKey))
}
