import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createSmoothScroll } from './smoothScroll.js'

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
 * inertial motion by Lenis (`smoothScroll.js`) — ScrollTrigger just stays
 * in sync with Lenis's already-smoothed scroll position, so `scrub` only
 * needs to add a light extra touch of catch-up smoothing rather than
 * carry the whole "glide to rest" feel itself. Together this is fully
 * reversible, with no section-snapping and no auto-scroll.
 */
export function ScrollSpacer() {
  const spacerRef = useRef(null)

  useEffect(() => {
    const smoothScroll = createSmoothScroll(ScrollTrigger.update)

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: spacerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.15,
        onUpdate: (self) => {
          scrollProgress.value = self.progress
        },
      },
    })

    return () => {
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
