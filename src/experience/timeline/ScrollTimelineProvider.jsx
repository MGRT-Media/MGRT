import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createSmoothScroll } from './smoothScroll.js'
import {
  ESTABLISH_T,
  ESTABLISH_SNAP_CAPTURE_RADIUS,
  FILM_FOCUS_T,
  FILM_SNAP_CAPTURE_RADIUS,
  MONITOR_SNAP_T,
  MONITOR_SNAP_CAPTURE_RADIUS,
} from './filmActBeats.js'

gsap.registerPlugin(ScrollTrigger)

/**
 * Shared mutable progress value (0–1), written by the GSAP/ScrollTrigger
 * master timeline below and read directly inside R3F's `useFrame` loop
 * (see `ScrollCameraRig.jsx`). A plain object reference — not React state
 * — so scroll updates never trigger a React re-render or component state
 * dispatch, per technical-architecture.md §7.
 */
export const scrollProgress = { value: 0 }

// Provisional total scroll distance for this phase's camera/scroll proof —
// not the final act-by-act pacing, which is tuned once Phase 1D/Phase 2
// content exists. Expressed as a multiple of the cached viewport height
// (not raw vh) so it doesn't shift when the mobile browser chrome resizes.
const SCROLL_LENGTH_MULTIPLIER = 3

/**
 * Renders the scroll-height spacer and owns the single master GSAP
 * timeline: a `gsap.timeline({ scrollTrigger: { scrub, ... } })` whose
 * ScrollTrigger drives `scrollProgress.value` from 0 to 1 across the
 * spacer's height. Raw wheel/touch input is first normalized into smooth,
 * inertial motion by Lenis (`smoothScroll.js`); `scrub: 1` then adds a
 * further second of its own catch-up smoothing on top, so individual
 * wheel notches/trackpad steps absorb into one continuous, fluid motion
 * rather than each nudging the timeline forward in a visible little step.
 * Lowered from 1.5 back to 1 alongside `cameraPath.js`'s asymmetric ease —
 * with the path itself now fully responsive (linear) through progress
 * 0.85, the extra half-second of scrub lag was adding a dead zone on top
 * of an already-fixed ease-in problem rather than softening anything.
 *
 * `scrollTrigger.snap` (below) is a deliberate, localized supersession of
 * this file's prior "no section-snapping" note, per explicit request for
 * "3 distinct, locked snap/pause positions": Snap 1 (Studio Scene
 * establish, `ESTABLISH_T`), Snap 2 (Cinema Lens, `FILM_FOCUS_T`), and
 * Snap 3 (Digital Monitor, `MONITOR_SNAP_T`, the end of the timeline). It
 * is NOT full-timeline sectioning — the snap function only pulls the
 * resting scroll position onto one of those three points when the user
 * stops scrolling within its own small capture radius; everywhere else
 * (the entrance glide, the approach into and pull-back out of the lens,
 * the sweep into the Monitor) remains freely continuous. Still fully
 * reversible: all three capture radii are symmetric, so approaching from
 * either scroll direction settles at the same point, and scrolling
 * decisively past one continues normally with no fight — satisfying
 * "release on scroll past this snap point" for free.
 */
export function ScrollSpacer() {
  const spacerRef = useRef(null)

  useEffect(() => {
    // Lenis first, then the GSAP master timeline that reads its scroll —
    // the timeline's ScrollTrigger must exist before anything can drive it.
    const smoothScroll = createSmoothScroll(ScrollTrigger.update)

    // Pulls the resting scroll position onto whichever snap point (if
    // any) the user stopped within its own capture radius of. Outside
    // all three radii the raw stopped position is returned unchanged —
    // no snap, free scroll — so this only affects the three "click"
    // beats, not the rest of the timeline.
    const snapTo = (value) => {
      if (Math.abs(value - ESTABLISH_T) < ESTABLISH_SNAP_CAPTURE_RADIUS) return ESTABLISH_T
      if (Math.abs(value - FILM_FOCUS_T) < FILM_SNAP_CAPTURE_RADIUS) return FILM_FOCUS_T
      if (Math.abs(value - MONITOR_SNAP_T) < MONITOR_SNAP_CAPTURE_RADIUS) return MONITOR_SNAP_T
      return value
    }

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: spacerRef.current,
        scroller: window,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        snap: {
          snapTo,
          duration: { min: 0.2, max: 0.5 },
          ease: 'power2.out',
          delay: 0.05,
        },
        onUpdate: (self) => {
          scrollProgress.value = self.progress
        },
      },
    })

    // Wakes GSAP's internal progress cache immediately rather than waiting
    // for the first real scroll tick to populate it.
    timeline.progress(0.0001)
    timeline.progress(0)

    // The Canvas (mounted alongside this component) can still be settling
    // its own layout/DPR sizing in the same tick ScrollTrigger measures
    // `spacerRef`'s height — a stale measurement here is what leaves
    // scroll input and camera progress out of sync from the very first
    // scroll. Refreshing once after mount, on the next frame, re-measures
    // against final layout without waiting for a resize event to do it.
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh())

    return () => {
      cancelAnimationFrame(raf)
      timeline.scrollTrigger?.kill()
      timeline.kill()
      smoothScroll.dispose()
    }
  }, [])

  return (
    <div
      ref={spacerRef}
      className="scroll-spacer"
      style={{ height: `calc(var(--app-height) * ${SCROLL_LENGTH_MULTIPLIER})` }}
    />
  )
}
