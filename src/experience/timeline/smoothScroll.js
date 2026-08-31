import Lenis from 'lenis'
import gsap from 'gsap'

/**
 * Natural ease-out-cubic glide-to-rest curve — scroll momentum decays
 * smoothly rather than snapping to a hard stop.
 */
function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

/**
 * Normalizes raw wheel/touch input into smooth, inertial scroll motion
 * (Lenis), then keeps GSAP's ScrollTrigger in sync with it every tick —
 * the standard Lenis/GSAP integration. `syncTouch` gives touch gestures
 * the same lerp/duration physics as desktop wheel scrolling, per this
 * phase's requirement.
 *
 * Honors `prefers-reduced-motion` automatically (Lenis's
 * `respectReducedMotion`, on by default): smoothing collapses to a 1:1
 * lerp so scroll tracks input directly, consistent with
 * technical-architecture.md §18.
 */
export function createSmoothScroll(onScroll) {
  const lenis = new Lenis({
    duration: 1.2,
    easing: easeOutCubic,
    lerp: 0.11,
    smoothWheel: true,
    syncTouch: true,
    // Explicit (not just Lenis's default) so touch and wheel decay with
    // the same physical weight rather than two independently-tuned feels.
    syncTouchLerp: 0.11,
  })

  lenis.on('scroll', onScroll)

  const tick = (time) => {
    lenis.raf(time * 1000)
  }
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  return {
    lenis,
    dispose() {
      gsap.ticker.remove(tick)
      lenis.destroy()
    },
  }
}
