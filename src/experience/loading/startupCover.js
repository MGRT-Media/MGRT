/**
 * The black the opening fades in from (`#startup-cover` in `index.html`).
 *
 * The cover is painted with the HTML, before any JavaScript, so the page is the
 * void from its first frame. The scene mounts and renders underneath it, and
 * the reveal is this cover fading away — a short opacity fade over a view that
 * is already on the compositor, rather than the canvas itself fading in from
 * opacity 0. It is removed once the fade has finished, so it can never block a
 * click or a scroll.
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
 */
export function revealStartupCover({ immediate = false } = {}) {
  const element = cover()
  if (!element) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (immediate || reducedMotion) {
    element.remove()
    return
  }
  element.classList.add('startup-cover--revealing')
  element.addEventListener('transitionend', () => element.remove(), { once: true })
  // Removed even if `transitionend` never arrives (a tab hidden mid-fade).
  setTimeout(() => element.remove(), FADE_MS + 100)
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
}

export function isExperienceRevealed() {
  return revealed
}
