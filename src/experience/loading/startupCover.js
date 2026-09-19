/**
 * What the opening fades in from (`#startup-cover` in `index.html`).
 *
 * The cover is painted with the HTML, before any JavaScript: black for the
 * first instant, then the opening frame of the scene as an image once that has
 * decoded (`scripts/capture-opening.mjs`). The scene mounts and renders
 * underneath it, and the reveal is this cover fading away — which, with the
 * image on it, is a crossfade from a picture of the first live frame into the
 * first live frame. It is removed once the fade has finished, so it can never
 * block a click or a scroll.
 *
 * Its only content is the failure state: if the experience cannot start at
 * all, the cover stays and says so, with a retry.
 *
 * No three.js import here, so the router can use it on every page without
 * pulling the scene into the initial bundle.
 */

/** Matches `.startup-cover`'s own opacity transition in `index.html`. */
const FADE_MS = 400

let revealed = false
const revealListeners = new Set()

/**
 * The visitor's latest request while the experience was loading: a section
 * (`{ type: 'section', key }`) or a step forward (`{ type: 'forward' }`).
 *
 * Recorded HERE rather than in the timeline because the timeline does not
 * exist for most of the wait. The opening image is on screen long before the
 * scene is mounted — up to ~15s on a slow connection — and that is exactly
 * when people scroll at it. This module is in the main bundle, so it listens
 * from almost the first moment; the timeline takes the intent over at the
 * reveal (`takeStartupIntent`).
 *
 * Only the latest intent, and only as a direction: ten wheel ticks are one step
 * forward, never ten. Backward clears it — at the opening there is nowhere
 * further back to go.
 */
let startupIntent = null
let touchStartY = null
const FORWARD_KEYS = new Set(['ArrowDown', 'PageDown', 'End', ' '])
const BACKWARD_KEYS = new Set(['ArrowUp', 'PageUp', 'Home'])

export function recordStartupIntent(intent) {
  startupIntent = intent
}

/** The pending intent, cleared as it is taken — acted on exactly once. */
export function takeStartupIntent() {
  const intent = startupIntent
  startupIntent = null
  return intent
}

function recordDirection(direction) {
  if (direction > 0) startupIntent = { type: 'forward' }
  else if (direction < 0) startupIntent = null
}

function onStartupInput(event) {
  if (revealed) return
  if (event.type === 'wheel') recordDirection(Math.sign(event.deltaY))
  else if (event.type === 'keydown') {
    if (event.target?.closest?.('#startup-cover')) return
    if (FORWARD_KEYS.has(event.key)) recordDirection(1)
    else if (BACKWARD_KEYS.has(event.key)) recordDirection(-1)
  } else if (event.type === 'touchstart') touchStartY = event.touches[0]?.clientY ?? null
  else if (event.type === 'touchmove' && touchStartY !== null) {
    const y = event.touches[0]?.clientY
    // Dragging up pulls content up: the touch equivalent of scrolling forward.
    if (y !== undefined && Math.abs(touchStartY - y) > 6) recordDirection(Math.sign(touchStartY - y))
  }
}

// Passive and observational only: nothing is prevented here. Before the scene
// mounts there is nothing for input to move; once it mounts, the timeline's
// own capture-phase gate holds the input until the reveal.
const STARTUP_INPUT = ['wheel', 'keydown', 'touchstart', 'touchmove']
if (typeof window !== 'undefined' && document.getElementById('startup-cover')) {
  STARTUP_INPUT.forEach((type) => window.addEventListener(type, onStartupInput, { passive: true, capture: true }))
}

function stopRecordingStartupIntent() {
  STARTUP_INPUT.forEach((type) => window.removeEventListener(type, onStartupInput, { capture: true }))
}

function cover() {
  return document.getElementById('startup-cover')
}

/** True while the cover is up and not already fading away. */
export function isStartupCoverShown() {
  const element = cover()
  return Boolean(element) && !element.classList.contains('startup-cover--revealing')
}

/**
 * Fades the cover away and removes it — or, with `immediate`, just removes it
 * (a page that is not the experience has nothing to fade in). Safe to call
 * more than once.
 *
 * `onRevealed` runs once the cover is GONE, not when it starts to go. The
 * experience takes input from that moment: a camera that started moving while
 * the image was still half on screen would show two frames at once, out of
 * register. With no cover (a return from an internal page) it runs at once.
 */
export function revealStartupCover({ immediate = false, onRevealed } = {}) {
  let done = false
  const finish = () => {
    if (done) return
    done = true
    cover()?.remove()
    // Intent only means something while the cover is up. Stop listening either
    // way, and when this is not the experience being revealed (an internal
    // page removing the cover it does not need) discard what was recorded —
    // otherwise scrolling on /work, then navigating home, would replay a
    // stale gesture as the opening's first move.
    stopRecordingStartupIntent()
    if (!onRevealed) startupIntent = null
    onRevealed?.()
  }
  const element = cover()
  if (!element) {
    finish()
    return
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (immediate || reducedMotion) {
    finish()
    return
  }
  element.classList.add('startup-cover--revealing')
  element.addEventListener('transitionend', (event) => {
    // The image inside fades too; only the cover's own fade ends the reveal.
    if (event.target === element) finish()
  })
  // Finished even if `transitionend` never arrives (a tab hidden mid-fade).
  setTimeout(finish, FADE_MS + 100)
}

/** Shows that the experience cannot start, with a way to try again. */
export function showStartupFailure() {
  const element = cover()
  if (!element) return
  element.classList.remove('startup-cover--revealing')
  element.querySelector('.startup-cover__message').hidden = false
  const retry = element.querySelector('.startup-cover__retry')
  retry.hidden = false
  retry.onclick = () => window.location.reload()
  retry.focus({ preventScroll: true })
}

/**
 * Whether the experience is on screen. Set by `Home` when the scene is
 * revealed and cleared when it unmounts. Scroll input is ignored until then,
 * so a gesture made while the scene is still being prepared behind the cover
 * cannot start the camera moving where nobody can see it.
 */
export function setExperienceRevealed(value) {
  revealed = value
  if (!value) return
  stopRecordingStartupIntent()
  revealListeners.forEach((listener) => listener())
}

/**
 * Runs `listener` each time the experience becomes visible and able to take
 * input. The timeline uses it to act on a gesture or section request that was
 * made while the scene was still loading.
 */
export function onExperienceRevealed(listener) {
  revealListeners.add(listener)
  return () => revealListeners.delete(listener)
}

export function isExperienceRevealed() {
  return revealed
}
