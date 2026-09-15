import { useEffect, useState } from 'react'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { requestNavigate } from '../timeline/sectionNavigationEvent.js'
import { DIGITAL_EXIT_T, FILM_FOCUS_T, MONITOR_SNAP_T } from '../timeline/filmActBeats.js'

// Four physical markers for the four narrative states: Intro → Film →
// Digital → the MGRT hero. Intro and the hero are the bookend states and are
// deliberately unlabeled (`label: null`) even when active. `key` matches
// SECTION_TARGETS' keys (filmActBeats.js), which is what a click hands to the
// section flight.
const SECTIONS = [
  { key: 'intro', label: null, ariaName: 'Intro' },
  { key: 'film', label: 'FILM', ariaName: 'Film' },
  { key: 'digital', label: 'DIGITAL', ariaName: 'Digital' },
  { key: 'hero', label: null, ariaName: 'MGRT Media' },
]
const FILM_INDEX = 1
const DIGITAL_INDEX = 2
const HERO_INDEX = 3

/**
 * Which of the four markers is "active" (current-section treatment),
 * derived directly from `scrollProgress.value` — the exact same normalized
 * progress that drives the Three.js camera (`ScrollCameraRig.jsx`/
 * `cameraPath.js`). A click's section flight moves scroll to the destination
 * the moment it starts (see `ScrollTimelineProvider.jsx`'s `flyToSection`), so
 * the mark shows where the visitor is going for the whole flight. Never a
 * second, independent section-detection system.
 *
 * Returns `null` for "no marker active" (Intro) rather than an Intro index —
 * the Intro *position* in the row is real (it reserves its slot in the layout),
 * but it never shows the active treatment.
 *
 * `FILM_FOCUS_T`/`MONITOR_SNAP_T` are the same Cinema Lens / Digital Monitor
 * landmark constants the camera itself locks onto — Film only becomes
 * active once the camera has actually arrived at the lens, not at a generic
 * scroll percentage.
 */
function getActiveIndex(progress) {
  if (progress < FILM_FOCUS_T) return null
  if (progress < MONITOR_SNAP_T) return FILM_INDEX
  // The hero takes over once the camera has actually left the monitor on its
  // way to the wordmark (`DIGITAL_EXIT_T`), not the moment progress passes
  // Digital's resting point — same principle as Film above.
  if (progress < DIGITAL_EXIT_T) return DIGITAL_INDEX
  return HERO_INDEX
}

/**
 * The cinematic side navigation. Started as a passive chapter marker; per
 * explicit request it became genuinely clickable — each mark is a real
 * `<button>` that hands off to `sectionNavigationEvent.js`'s `requestNavigate`,
 * which `ScrollTimelineProvider.jsx` (the existing scroll/camera state machine)
 * picks up and turns into a direct section flight — straight to that section,
 * without replaying the ones in between. This component never touches
 * camera/scroll state directly — it only ever reads `scrollProgress.value`
 * (for the active-index display) and emits navigation requests.
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
            {/* Intro/the hero (label === null) never show text, even on
                hover/active — the bookend states are represented by a
                plain small line, not an expanded-but-empty one. */}
            {section.label && <span className="section-indicator__label">{section.label}</span>}
          </button>
        )
      })}
    </nav>
  )
}
