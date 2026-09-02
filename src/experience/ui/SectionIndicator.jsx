import { useEffect, useState } from 'react'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { requestNavigate } from '../timeline/sectionNavigationEvent.js'
import { FILM_FOCUS_T, MONITOR_SNAP_T, SECTION_TARGETS } from '../timeline/filmActBeats.js'

// Five physical markers for the five narrative states (creative-reference.md
// §7's Act structure: Intro → Film → Digital → Campaigns → Return). Intro
// and Return are the bookend states and are deliberately unlabeled
// (`label: null`) even when active — see LABEL_HIDDEN handling below.
// `key` matches SECTION_TARGETS' keys (filmActBeats.js) — Campaigns and
// Return simply have no entry there (no real camera landmark exists yet),
// which is what makes clicking them a no-op below, without a second
// duplicate "is this navigable" list to keep in sync.
const SECTIONS = [
  { key: 'intro', label: null, ariaName: 'Intro' },
  { key: 'film', label: 'FILM', ariaName: 'Film' },
  { key: 'digital', label: 'DIGITAL', ariaName: 'Digital' },
  { key: 'campaigns', label: 'CAMPAIGNS', ariaName: 'Campaigns' },
  { key: 'return', label: null, ariaName: 'Return' },
]
const FILM_INDEX = 1
const DIGITAL_INDEX = 2

/**
 * Which of the five markers is "active" (current-section treatment),
 * derived directly from `scrollProgress.value` — the exact same normalized
 * progress that drives the Three.js camera (`ScrollCameraRig.jsx`/
 * `cameraPath.js`), including while a direct-navigation jump (below) is in
 * flight, since that jump animates `scrollProgress.value` through the same
 * pipeline as scroll. Never a second, independent section-detection system.
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
  if (progress < FILM_FOCUS_T) return null
  if (progress < MONITOR_SNAP_T) return FILM_INDEX
  return DIGITAL_INDEX
}

/**
 * The five-line cinematic side navigation. Started as a passive chapter
 * marker; per explicit request this round it becomes genuinely clickable —
 * each mark is a real `<button>` that hands off to
 * `sectionNavigationEvent.js`'s `requestNavigate`, which
 * `ScrollTimelineProvider.jsx` (the existing scroll/camera state machine)
 * picks up and turns into a smooth jump along the same physical camera
 * track scroll already uses. This component never touches camera/scroll
 * state directly — it only ever reads `scrollProgress.value` (for the
 * active-index display) and emits navigation requests.
 *
 * Default appearance stays intentionally minimal (small marks, no visible
 * labels) — hover/focus reveal is handled entirely in CSS
 * (`.section-indicator__row:hover`/`:focus-visible`), not JS state, per
 * explicit request that expand/reveal use plain CSS transitions rather than
 * GSAP. `useState` here is reserved for the *active section* indicator,
 * which changes rarely (a handful of times across the whole experience),
 * matching `ScrollLockIndicator.jsx`'s established exception to "no React
 * state for scroll-driven values."
 *
 * Campaigns and Return have no entry in `SECTION_TARGETS` (no real camera
 * landmark exists yet for either — see that constant's own doc comment in
 * filmActBeats.js) — their marks stay visually identical and hoverable
 * (matching the UI spec) but clicking them is a no-op, guarded both here
 * and again inside `ScrollTimelineProvider.jsx`'s own handler.
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
        const isNavigable = SECTION_TARGETS[section.key] !== undefined
        return (
          <button
            key={section.key}
            type="button"
            className={`section-indicator__row${isActive ? ' section-indicator__row--active' : ''}${
              isNavigable ? '' : ' section-indicator__row--disabled'
            }`}
            onClick={() => isNavigable && requestNavigate(section.key)}
            aria-label={isNavigable ? `Go to ${section.ariaName}` : `${section.ariaName} (not yet available)`}
            aria-disabled={!isNavigable}
            aria-current={isActive ? 'true' : undefined}
          >
            <span className="section-indicator__line" aria-hidden="true" />
            {/* Intro/Return (label === null) never show text, even on
                hover/active — the bookend states are represented by a
                plain small line, not an expanded-but-empty one. */}
            {section.label && <span className="section-indicator__label">{section.label}</span>}
          </button>
        )
      })}
    </nav>
  )
}
