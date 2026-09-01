/**
 * A small, reusable pub/sub for "the scroll has been force-stopped at a
 * snap point" (and its release) — framework-agnostic, matching this
 * codebase's established pattern (see `cameraLockEvent.js`) of plain
 * mutable module state rather than React state for scroll-driven values
 * (technical-architecture.md §7).
 *
 * `ScrollTimelineProvider.jsx` is the only writer (`setScrollLocked`,
 * called from its GSAP snap `onComplete`/drift-override logic). The only
 * reader in this codebase today is `ScrollLockIndicator.jsx` (a DOM
 * overlay, not a 3D object), which is why this one keeps `useState`
 * inside its own subscribing component instead of the ref-based
 * `useFrame` pattern `cameraLockEvent.js`'s WebGL consumers use — an
 * occasional discrete UI-visibility toggle is a reasonable exception to
 * "no React state for scroll-driven values," which targets per-frame
 * values, not rare boolean flips.
 */
let locked = false
const lockListeners = new Set()
const unlockListeners = new Set()

/** Registers a callback for when scroll force-stops at a snap point. Returns an unsubscribe function. */
export function onScrollLock(callback) {
  lockListeners.add(callback)
  return () => lockListeners.delete(callback)
}

/** Registers a callback for when the scroll lock releases. Returns an unsubscribe function. */
export function onScrollUnlock(callback) {
  unlockListeners.add(callback)
  return () => unlockListeners.delete(callback)
}

export function setScrollLocked(nextLocked) {
  if (nextLocked === locked) return
  locked = nextLocked
  const listeners = locked ? lockListeners : unlockListeners
  listeners.forEach((callback) => callback())
}
