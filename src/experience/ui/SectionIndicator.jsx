import { useEffect, useState } from 'react'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { FILM_FOCUS_T } from '../timeline/filmActBeats.js'

const SECTIONS = ['FILM', 'DIGITAL', 'CAMPAIGNS', 'RETURN']

/**
 * Which of the four chapters is "active," derived directly from
 * `scrollProgress.value` — the exact same normalized progress that drives
 * the Three.js camera (`ScrollCameraRig.jsx`/`cameraPath.js`). Per
 * explicit request, this must not become a second, independent
 * section-detection system.
 *
 * Only FILM and DIGITAL have a real boundary to derive from right now:
 * Phase 2's built experience covers `t: 0` (Entrance) through `t: 1`
 * (Digital Monitor lock) only. CAMPAIGNS (the billboard reveal, Phase 1E)
 * and RETURN (the dive-back-in, Phase 3) are both still "NOT STARTED" per
 * build-status.md — there is no real scroll-progress boundary for either
 * one yet. Rather than invent placeholder ranges for them (exactly the
 * "second independent section-detection system" the request rules out),
 * this returns 0/1 only; their lines simply stay in their default
 * (inactive) state until those acts exist and this function has a real
 * boundary to read for them. `cameraPath.js`'s own `FILM_FOCUS_T` is
 * reused directly, not re-derived, so the two can never drift apart.
 */
function getActiveIndex(progress) {
  return progress < FILM_FOCUS_T ? 0 : 1
}

/**
 * The four-line chapter marker (per explicit request: "NOT a traditional
 * sidebar navigation" — purely a "you've reached a new chapter" cue). A
 * DOM overlay outside the Canvas, matching `ScrollLockIndicator.jsx`'s
 * pattern — including its use of ordinary `useState` for a value that
 * changes rarely (here, at most once in the whole currently-built
 * experience), not per frame; see that component's own note on why this
 * is a reasonable exception to "no React state for scroll-driven values."
 * Polls `scrollProgress.value` once per animation frame but only calls
 * `setActiveIndex` on an actual chapter change, so re-renders stay rare
 * regardless of how often scroll itself updates.
 *
 * Visibility: the request asks for this to disappear outside "Experience
 * mode" (a future normal `WORK` section). That mode doesn't exist in the
 * app yet — the whole current app IS the cinematic experience — so there
 * is nothing to hide this for yet; it renders unconditionally, ready for
 * a `visible` prop once that mode-switch is actually built. Per explicit
 * request, this round does not redesign the cinematic sequence (or add
 * the WORK section) to accommodate this element.
 */
export default function SectionIndicator() {
  const [activeIndex, setActiveIndex] = useState(() => getActiveIndex(scrollProgress.value))

  useEffect(() => {
    let rafId
    let lastIndex = getActiveIndex(scrollProgress.value)
    const tick = () => {
      const next = getActiveIndex(scrollProgress.value)
      if (next !== lastIndex) {
        lastIndex = next
        setActiveIndex(next)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div className="section-indicator" aria-hidden="true">
      {SECTIONS.map((label, index) => (
        <div
          key={label}
          className={`section-indicator__row${index === activeIndex ? ' section-indicator__row--active' : ''}`}
        >
          <span className="section-indicator__line" />
          <span className="section-indicator__label">{label}</span>
        </div>
      ))}
    </div>
  )
}
