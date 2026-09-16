import { loadInscriptionBrass } from '../architecture/wallInscription.js'

/**
 * Files the experience wants, but the opening frame does not.
 *
 * Started once the scene is on screen and the page is idle, so they cost the
 * visitor nothing before the reveal and are resident long before the beat that
 * uses them. Today that is the brass inlay on the MGRT wordmark: 246KB whose
 * presence or absence is below the measurable difference between two runs of
 * the same build, and which the hero beat is many interactions away from.
 *
 * Idempotent: the work runs once per page, however often this is called.
 */

/** How long after the reveal to ask for idle time, so the opening's own first frames are undisturbed. */
const DELAY_MS = 1200

let started = null

function whenIdle(callback) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(callback, { timeout: 3000 })
  else setTimeout(callback, 200)
}

export function loadDeferredAssets() {
  if (started) return started
  started = new Promise((resolve) => {
    setTimeout(() => whenIdle(() => resolve(loadInscriptionBrass())), DELAY_MS)
  })
  return started
}
