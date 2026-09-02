import { useEffect, useState } from 'react'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { FILM_FOCUS_T, MONITOR_SNAP_T } from '../timeline/filmActBeats.js'

// Five physical markers for the five narrative states (creative-reference.md
// §7's Act structure: Intro → Film → Digital → Campaigns → Return), per
// explicit request. Intro and Return are the bookend states and are
// deliberately unlabeled (`null`) even when — for Return, once it exists —
// they become the active marker; see LABEL_HIDDEN_INDICES below.
const SECTIONS = [null, 'FILM', 'DIGITAL', 'CAMPAIGNS', null]
const INTRO_INDEX = 0
const FILM_INDEX = 1
const DIGITAL_INDEX = 2
// CAMPAIGNS_INDEX = 3, RETURN_INDEX = 4 — not yet reachable; see below.

/**
 * Which of the five markers is "active" (expanded + labeled), derived
 * directly from `scrollProgress.value` — the exact same normalized
 * progress that drives the Three.js camera (`ScrollCameraRig.jsx`/
 * `cameraPath.js`). Per explicit request, this must not become a second,
 * independent section-detection system, and must trigger on the actual
 * camera landmark (the lens/monitor lock points), not a generic percentage.
 *
 * Returns `null` for "no marker active" (State 1 — Intro: "all markers
 * small... no active section"), not `INTRO_INDEX` — the Intro/Return
 * *positions* in the row are real (they reserve their slot in the
 * five-line layout), but neither one ever visually expands or shows a
 * label; they're represented by the *absence* of any active marker, per
 * explicit request ("Do NOT display INTRO... the viewer should simply see
 * the indicator transition back to its original blank state").
 *
 * `FILM_FOCUS_T` and `MONITOR_SNAP_T` are `cameraPath.js`'s own existing
 * landmark constants (the Cinema Lens hard-lock point and the Digital
 * Monitor hard-lock point, reused directly here, not re-derived) — the
 * only two points in the currently-built experience where the camera has
 * genuinely "arrived" somewhere rather than still being in transit:
 *   - Below FILM_FOCUS_T: still approaching (Entrance/Establish/Approach)
 *     — Intro, no marker active. Previously (before this round) this
 *     whole span was mislabeled FILM; the fix is deliberate, per explicit
 *     request that Film "should NOT trigger... merely because the user
 *     has scrolled a certain generic percentage."
 *   - [FILM_FOCUS_T, MONITOR_SNAP_T): the camera has reached the lens and
 *     is later pulling back/panning toward the monitor — Film stays
 *     active through this whole span, since no further real landmark
 *     exists between the two locks to split it on.
 *   - MONITOR_SNAP_T and beyond: the camera has reached the monitor —
 *     Digital.
 *
 * CAMPAIGNS (the billboard reveal, Phase 1E) and RETURN (the dive-back-in,
 * Phase 3) are both still "NOT STARTED" per build-status.md — there is no
 * real camera landmark for either one yet, and `scrollProgress.value`
 * never exceeds `MONITOR_SNAP_T` (1) in the currently-built timeline.
 * Inventing placeholder progress ranges for them would itself be the
 * "second independent section-detection system" this request rules out,
 * so this function simply never returns their indices right now — their
 * markers stay in their default (inactive, unlabeled-when-active-anyway)
 * state until those acts are built and give this function real boundaries
 * to extend with.
 */
function getActiveIndex(progress) {
  if (progress < FILM_FOCUS_T) return null
  if (progress < MONITOR_SNAP_T) return FILM_INDEX
  return DIGITAL_INDEX
}

/**
 * The five-line cinematic chapter marker (per explicit request: "NOT a
 * traditional sidebar navigation" — purely a "you've reached a new
 * chapter" cue). A DOM overlay outside the Canvas, matching
 * `ScrollLockIndicator.jsx`'s pattern — including its use of ordinary
 * `useState` for a value that changes rarely (at most twice across the
 * whole currently-built experience: Intro→Film, Film→Digital), not per
 * frame; see that component's own note on why this is a reasonable
 * exception to "no React state for scroll-driven values." Polls
 * `scrollProgress.value` once per animation frame but only calls
 * `setActiveIndex` on an actual chapter change, so re-renders stay rare
 * regardless of how often scroll itself updates — this is also what makes
 * fast/skipped scrolling settle correctly: there's no queued animation to
 * finish, each poll just reads the camera's current authoritative state.
 *
 * Visibility: the request asks for this to disappear outside "Experience
 * mode" (a future normal `WORK` section). That mode doesn't exist in the
 * app yet — the whole current app IS the cinematic experience — so there
 * is nothing to hide this for yet; it renders unconditionally, ready for
 * a `visible` prop once that mode-switch is actually built.
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
      {SECTIONS.map((label, index) => {
        const isActive = index === activeIndex
        // Intro/Return (label === null) never show text even if somehow
        // active — the bookend states are represented by a plain small
        // line, not an expanded-but-empty one.
        return (
          <div
            key={index}
            className={`section-indicator__row${isActive ? ' section-indicator__row--active' : ''}`}
          >
            <span className="section-indicator__line" />
            {label && <span className="section-indicator__label">{label}</span>}
          </div>
        )
      })}
    </div>
  )
}
