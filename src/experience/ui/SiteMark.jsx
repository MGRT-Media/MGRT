import { requestNavigate } from '../timeline/sectionNavigationEvent.js'

/**
 * A single discreet serif wordmark, top-left — the one piece of literal
 * museum-exhibit typography this project adopts from the 2026-09-05
 * Musée-reference restraint pass (`creative-reference.md` §4A).
 *
 * Per explicit request it is also the way back to the start: a click hands
 * the same `intro` request the side navigation's Intro mark sends to
 * `ScrollTimelineProvider.jsx`, which flies the camera straight to the opening
 * view outside the pillars and keeps scroll, chapter state and content in
 * step — interruptions, reduced motion and all. No second navigation path.
 * It looks exactly as it did; only the hover and focus states are added.
 */
export default function SiteMark() {
  return (
    <button
      type="button"
      className="site-mark"
      aria-label="MGRT Media — Back to start"
      onClick={() => requestNavigate('intro')}
    >
      MGRT Media
    </button>
  )
}
