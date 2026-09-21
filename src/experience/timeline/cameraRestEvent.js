/**
 * "The camera has actually stopped."
 *
 * Arriving at a section and coming to rest on it are two different moments.
 * A move's scroll tween lands first; the camera is still closing the last of
 * the distance behind it (`ScrollCameraRig` damps toward the path rather than
 * being placed on it), and on the Digital -> hero traversal that tail runs for
 * most of three seconds after the tween is done.
 *
 * Anything that has to begin from a genuinely still frame therefore cannot key
 * off the arrival — it has to key off this. The final beat's one-second hero
 * hold is the only listener today: the hold has to BE still, so it starts when
 * the camera is at its target exactly, which is the same test the rig already
 * uses to stop interpolating and place the camera on the path itself.
 *
 * Small pub/sub over plain module state, matching `sectionNavigationEvent.js`
 * and `scrollLockEvent.js` rather than introducing another pattern.
 */

const listeners = new Set()

/** Registers a callback for "the camera just came to rest". Returns an unsubscribe. */
export function onCameraSettled(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

/**
 * Announced once per settle, by `ScrollCameraRig`, with the progress the
 * camera came to rest at — not on every settled frame, or a listener would be
 * called sixty times a second for as long as nobody scrolled.
 */
export function announceCameraSettled(progress) {
  listeners.forEach((callback) => callback(progress))
}
