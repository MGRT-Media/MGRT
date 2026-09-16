import { loadInscriptionBrass } from '../architecture/wallInscription.js'
import { upgradeSky } from '../lighting/skyEnvironment.js'
import { propTexturesInstalled, setUpgradeRenderer, upgradePropTextures } from '../models/propTextureUpgrades.js'

/**
 * Everything the experience wants that the opening frame does not.
 *
 * Started once the scene is on screen and the page is idle, so none of it
 * competes with the reveal, and ordered by the beat that first needs it rather
 * than by size. Each step waits for the one before, so a slow connection
 * finishes the film camera's maps before it starts the monitor's instead of
 * making partial progress on both.
 *
 *   camera    full-resolution maps      needed by FILM_FOCUS_T    (0.45)
 *   sky       the original 1K HDRI      needed by FILM_FOCUS_T    (0.45)
 *   monitor   full-resolution maps      needed by MONITOR_SNAP_T  (0.60)
 *   brass     the wordmark inlay        needed at the hero        (0.90)
 *
 * The camera goes first and the sky second even though the sky is the larger
 * file: both are due at the same beat, and the camera is the subject of it
 * while the sky is the light falling on the room around it. The monitor's
 * deadline is later, and the brass is not on screen until the hero.
 *
 * Idempotent: the work runs once per page, however often this is called.
 */

/** How long after the reveal to ask for idle time, so the opening's own first frames are undisturbed. */
const DELAY_MS = 1200

let started = null
let activeRenderer = null
/**
 * The escalated request a visitor is currently waiting on, if any.
 *
 * The queue below yields to it between steps. Without that, a click on Digital
 * seconds after the reveal put the monitor's maps in competition with the
 * camera's and the sky's on one throttled pipe, and the visitor waited for all
 * three: 22 seconds on a 400kbit connection against 15 for the monitor alone.
 */
let escalation = null

/** Resolves when nothing is being waited on, so the queue can take the pipe back. */
function whenNotEscalated() {
  return escalation ?? Promise.resolve()
}

/**
 * What each section's close-up is drawn from, so a jump straight to it can be
 * held until those resources exist rather than revealing the boot versions.
 */
const SECTION_ASSETS = {
  film: ['camera'],
  digital: ['monitor'],
}

function whenIdle(callback) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(callback, { timeout: 3000 })
  else setTimeout(callback, 200)
}

export function loadDeferredAssets(renderer) {
  if (started) return started
  // `upgradePropTextures` and `upgradeSky` both put their results on the GPU
  // before installing them, which needs the renderer this scene is drawn with.
  activeRenderer = renderer
  setUpgradeRenderer(renderer)
  started = new Promise((resolve) => {
    setTimeout(() => whenIdle(resolve), DELAY_MS)
  })
    .then(whenNotEscalated)
    .then(() => upgradePropTextures('camera'))
    .then(whenNotEscalated)
    .then(() => upgradeSky(renderer))
    .then(whenNotEscalated)
    .then(() => upgradePropTextures('monitor'))
    .then(whenNotEscalated)
    .then(() => loadInscriptionBrass())
  return started
}

/**
 * True when the SUBJECT of `sectionKey`'s close-up is already at full quality.
 *
 * The sky is deliberately not part of this, and the reason is a measurement.
 * Holding a click until the 1K sky had also arrived was tried: on a 400kbit
 * connection it froze the camera for 46 seconds, because the sky is 915KB and
 * the prop the visitor actually asked to look at is 382KB. Waiting only for
 * the prop costs a third of that, and what the visitor would otherwise have
 * been waiting for is the light falling on the room rather than the object in
 * front of them — a difference measured at 6/255 in a single tile of one beat,
 * against a texture on the subject itself, which is plainly visible.
 *
 * On any normal connection every one of these is true before the visitor could
 * reach the navigation at all, and the wait below is never taken.
 */
export function sectionAssetsReady(sectionKey) {
  if (!activeRenderer) return true
  const props = SECTION_ASSETS[sectionKey]
  if (!props) return true
  return props.every(propTexturesInstalled)
}

/**
 * Brings `sectionKey`'s close-up resources forward and resolves when they are
 * installed.
 *
 * A visitor who clicks a section mark seconds after the reveal on a slow
 * connection can outrun the queue above, and the one thing that must not
 * happen is a close-up drawn from a boot texture. So the destination's assets
 * jump the queue and the move waits for them, holding the composition the
 * visitor can already see rather than travelling to a degraded one.
 */
export function ensureSectionAssets(sectionKey) {
  if (!activeRenderer) return Promise.resolve()
  const props = SECTION_ASSETS[sectionKey]
  if (!props) return Promise.resolve()
  // Only the destination's own maps, and nothing alongside them: on a slow
  // connection whatever else is started here shares the same pipe and makes
  // the visitor wait longer for the thing they asked to see. The queue above
  // stands down for the same reason.
  const work = Promise.all(props.map(upgradePropTextures))
  escalation = work.then(
    () => { escalation = escalation === work ? null : escalation },
    () => { escalation = escalation === work ? null : escalation },
  )
  return work
}
