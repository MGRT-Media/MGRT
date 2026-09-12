/**
 * A count of critical asset upgrades still in flight.
 *
 * Several materials in this room are built synchronously with a stand-in and
 * then UPGRADED in place when a downloaded file arrives — the scanned stone
 * sets (`stoneWallMaterial.js`) and the brass inlay (`wallInscription.js`).
 * That design is deliberate and is not changed here: it is what lets the room
 * exist on the first frame instead of suspending on 2MB of texture.
 *
 * What was missing is a way to know when those upgrades have finished, so the
 * scene could be held out of sight until they have. Without it the swap
 * happens on whatever frame the decode completes, in full view — which is
 * exactly the "textures pop onto already-visible geometry" this module exists
 * to make preventable.
 *
 * Registration happens during render (materials are created in `useMemo`), and
 * the gate is read from an effect, so by the time anything asks, every
 * material in the tree has already registered. See `SceneReady.jsx`.
 */

const listeners = new Set()
let pending = 0

/**
 * Registers an in-flight upgrade. Returns the promise unchanged so call sites
 * stay one-liners.
 */
export function trackAssetUpgrade(promise) {
  pending += 1
  const settle = () => {
    pending -= 1
    if (pending === 0) {
      // Copied before iterating: every listener removes itself, and mutating
      // the set mid-iteration would skip entries.
      Array.from(listeners).forEach((listener) => listener())
    }
  }
  promise.then(settle, settle)
  return promise
}

/** Resolves once no upgrade is outstanding. Resolves immediately if none is. */
export function whenAssetUpgradesSettled() {
  if (pending === 0) return Promise.resolve()
  return new Promise((resolve) => {
    const listener = () => {
      listeners.delete(listener)
      resolve()
    }
    listeners.add(listener)
  })
}
