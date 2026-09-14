import { useEffect, useState } from 'react'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { requestNavigate } from '../timeline/sectionNavigationEvent.js'
import { CAMPAIGNS_GATE_T, FILM_FOCUS_T, MONITOR_SNAP_T } from '../timeline/filmActBeats.js'
import { endingProgress } from '../timeline/endingSequence.js'

// Five physical markers for the five narrative states: Intro → Film →
// Digital → Campaigns → the closing frame. Intro and the ending are the
// bookend states and are deliberately unlabeled (`label: null`) even when
// active. `key` matches SECTION_TARGETS' keys (filmActBeats.js), which is
// what a click hands to the section flight.
const SECTIONS = [
  { key: 'intro', label: null, ariaName: 'Intro' },
  { key: 'film', label: 'FILM', ariaName: 'Film' },
  { key: 'digital', label: 'DIGITAL', ariaName: 'Digital' },
  { key: 'campaigns', label: 'CAMPAIGNS', ariaName: 'Campaigns' },
  { key: 'ending', label: null, ariaName: 'Ending' },
]
const FILM_INDEX = 1
const DIGITAL_INDEX = 2
const CAMPAIGNS_INDEX = 3
const ENDING_INDEX = 4

/**
 * Which of the five markers is "active" (current-section treatment),
 * derived directly from `scrollProgress.value` — the exact same normalized
 * progress that drives the Three.js camera (`ScrollCameraRig.jsx`/
 * `cameraPath.js`). A click's section flight moves scroll to the destination
 * the moment it starts (see `ScrollTimelineProvider.jsx`'s `flyToSection`), so
 * the mark shows where the visitor is going for the whole flight. Never a
 * second, independent section-detection system.
 *
 * Returns `null` for "no marker active" (Intro) rather than an Intro index —
 * the Intro/Return *positions* in the row are real (they reserve their slot
 * in the five-line layout), but neither one ever shows the active
 * treatment; they're represented by the absence of any active marker.
 *
 * `FILM_FOCUS_T`/`MONITOR_SNAP_T` are the same Cinema Lens / Digital Monitor
 * landmark constants the camera itself locks onto — Film only becomes
 * active once the camera has actually arrived at the lens, not at a generic
 * scroll percentage.
 */
function getActiveIndex(progress) {
  // The closing frame plays over Campaigns' own camera position, so scroll
  // progress cannot tell the two apart; the ending's destination does
  // (`endingProgress.target`, see `endingSequence.js`). It flips when a
  // gesture or click commits to entering or leaving, the same moment a
  // section flight moves scroll for every other mark.
  if (endingProgress.target === 1) return ENDING_INDEX
  if (progress < FILM_FOCUS_T) return null
  if (progress < MONITOR_SNAP_T) return FILM_INDEX
  // Campaigns takes over once the camera has actually left the monitor and
  // started the pull-back (`CAMPAIGNS_GATE_T`, the act's own first stage
  // boundary), not the moment progress passes Digital's resting point —
  // same principle as Film above: the mark follows the camera arriving
  // somewhere, not a generic scroll percentage.
  if (progress < CAMPAIGNS_GATE_T) return DIGITAL_INDEX
  return CAMPAIGNS_INDEX
}

/**
 * The five-line cinematic side navigation. Started as a passive chapter
 * marker; per explicit request this round it becomes genuinely clickable —
 * each mark is a real `<button>` that hands off to
 * `sectionNavigationEvent.js`'s `requestNavigate`, which
 * `ScrollTimelineProvider.jsx` (the existing scroll/camera state machine)
 * picks up and turns into a direct section flight — straight to that section,
 * without replaying the ones in between. This component never touches camera/scroll
 * state directly — it only ever reads `scrollProgress.value` and
 * `endingProgress.target` (for the active-index display) and emits navigation
 * requests.
 *
 * Default appearance stays intentionally minimal (small marks, no visible
 * labels) — hover/focus reveal is handled entirely in CSS
 * (`.section-indicator__row:hover`/`:focus-visible`), not JS state, per
 * explicit request that expand/reveal use plain CSS transitions rather than
 * GSAP. `useState` here is reserved for the *active section* indicator,
 * which changes rarely (a handful of times across the whole experience),
 * matching `ScrollLockIndicator.jsx`'s established exception to "no React
 * state for scroll-driven values."
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
    <nav className="section-indicator" aria-label="Cinematic sections">
      {SECTIONS.map((section, index) => {
        const isActive = index === activeIndex
        return (
          <button
            key={section.key}
            type="button"
            className={`section-indicator__row${isActive ? ' section-indicator__row--active' : ''}`}
            onClick={() => requestNavigate(section.key)}
            aria-label={`Go to ${section.ariaName}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <span className="section-indicator__line" aria-hidden="true" />
            {/* Intro/the ending (label === null) never show text, even on
                hover/active — the bookend states are represented by a
                plain small line, not an expanded-but-empty one. */}
            {section.label && <span className="section-indicator__label">{section.label}</span>}
          </button>
        )
      })}
    </nav>
  )
}
