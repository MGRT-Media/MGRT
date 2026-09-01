import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createSmoothScroll } from './smoothScroll.js'
import { setScrollLocked } from './scrollLockEvent.js'
import {
  ESTABLISH_T,
  ESTABLISH_SNAP_CAPTURE_RADIUS,
  FILM_FOCUS_T,
  FILM_SNAP_CAPTURE_RADIUS,
  MONITOR_SNAP_T,
  MONITOR_SNAP_CAPTURE_RADIUS,
  SCROLL_LOCK_HOLD_MS,
  SCROLL_LOCK_OVERRIDE_DRIFT,
  INTRO_ZONE_END_T,
  INTRO_MAX_RATE_PER_SECOND,
  INTRO_INTENT_DECAY_MS,
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

/**
 * A small "spring" nudge applied while the Snap 2 hard lock (below) is
 * active and the visitor tries to scroll anyway — read by
 * `ScrollCameraRig.jsx` to offset the camera very slightly along its own
 * view axis and decay back to 0, so an attempted scroll produces a
 * tactile push-and-release instead of nothing at all. Never touches
 * `scrollProgress.value` itself — purely cosmetic feedback layered on top
 * of the genuinely frozen camera target.
 */
export const scrollLockWobble = { value: 0 }

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
 * remains freely continuous. Still fully reversible: all three capture
 * radii are symmetric, so approaching from either scroll direction
 * settles at the same point.
 *
 * Snap 3 (Digital Monitor) keeps the softer "freeze scrollProgress.value,
 * let real scroll keep moving underneath" lock from the previous round —
 * safe there because `t: 1` is also the page's own native scroll floor,
 * so nothing can physically scroll past it regardless.
 *
 * Snap 2 (Cinema Lens) needed a genuinely strict lock instead: the
 * original round's lock only engaged on the snap tween's `onComplete`
 * (i.e. once the user had already stopped scrolling near it), so a
 * continuous fast scroll could sail straight through `FILM_FOCUS_T`
 * without the tween ever settling there, skipping the hero video
 * entirely. The fix added real threshold-crossing detection in
 * `onUpdate` (checked every tick, independent of whether scrolling has
 * stopped) plus a genuine hard block: `smoothScroll.lenis` is stopped
 * outright (Lenis's own API for suspending scroll input) and a
 * capture-phase wheel/touchmove listener additionally `preventDefault`s
 * for the hold's duration, so physical scrolling truly cannot advance
 * past the lens.
 *
 * That first fix only checked "is progress at-or-past `FILM_FOCUS_T`",
 * which only ever means anything on a forward (scrolling down) pass — it
 * was also gated behind a permanent `hasCompletedLensHold` flag that
 * stayed true forever after the first hold, so backscrolling through the
 * lens later skipped the lock entirely, per explicit follow-up report.
 * Both are fixed here: the lock is now driven by genuine bidirectional
 * *crossing* detection (comparing each tick's progress against the
 * previous tick's, `lastRawProgress` below, and checking whether
 * `FILM_FOCUS_T` fell strictly between them) rather than a one-sided
 * "is it past" check or a single-use flag — every time the visitor
 * crosses `FILM_FOCUS_T`, from either direction, in the same
 * uninterrupted scroll gesture, holds again. A static "progress >=
 * FILM_FOCUS_T" re-check without crossing detection would have been
 * wrong the other way: scrolling up from the Monitor starts at
 * `progress: 1`, which already satisfies ">= FILM_FOCUS_T" long before
 * actually reaching the lens, so it would have fired the instant they
 * started scrolling up instead of when they arrive.
 *
 * A literal second `ScrollTrigger.create({ pin: true })` was considered
 * and deliberately not used: this page has one continuous scrub timeline
 * over a single spacer, not a sectioned/pinned layout, and layering
 * GSAP's DOM-pinning mechanic (which inserts its own spacing and directly
 * manipulates element position) on top of an already-scrubbing trigger
 * sharing the same scroller risked exactly the kind of scroll-position
 * fighting this fix is trying to eliminate. Stopping Lenis achieves the
 * same "physical scrolling does not move the camera forward" result with
 * far less risk, given this project's existing architecture.
 *
 * Intro hard rate cap (`t: 0` through `INTRO_ZONE_END_T`, i.e.
 * `FILM_FOCUS_T`) — a proportional `wheelMultiplier` damper (0.35x) tried
 * first turned out not to be strict enough: per direct follow-up report,
 * a hard/repeated flick could still cover the whole zone in a handful of
 * events, since a multiplier still scales with arbitrarily large input.
 * This replaces it with a genuine ceiling: while `scrollProgress.value`
 * is inside the zone, `onIntroWheel`/`onIntroTouchMove` (capture-phase,
 * always attached) `preventDefault` every wheel/touch event and instead
 * of letting it reach Lenis, just record which direction the visitor is
 * pushing (`introIntentDirection`, decaying back to 0 after
 * `INTRO_INTENT_DECAY_MS` of no input — a pause reads as "stopped", never
 * as "keep going"). A `gsap.ticker` callback (`introTick`) then advances
 * `scrollProgress.value` itself at a flat `INTRO_MAX_RATE_PER_SECOND`
 * toward whichever direction is currently held, and mirrors that onto
 * the real scroll position via `lenis.scrollTo(..., { immediate: true,
 * force: true })` so the native scrollbar stays exactly in sync — `force`
 * is required here because Lenis's own `scrollTo` is a no-op while
 * stopped otherwise (confirmed against the installed package source).
 * Lenis itself stays fully stopped for the zone's entire span (see
 * `syncScrollSuspension`), so no amount of scrolling can move faster than
 * this cap, guaranteeing `INTRO_ZONE_END_T / INTRO_MAX_RATE_PER_SECOND`
 * as a real minimum traversal time rather than a statistical slowdown.
 * Still fully input-driven, not auto-play or filler motion — advancing
 * only happens while the visitor is actively pushing in a direction, and
 * stops the instant they stop, per experience-design.md §3's "Scroll
 * controls time" rule. Skipped entirely under `prefers-reduced-motion`,
 * since added scroll friction is the opposite of what that setting
 * requests.
 */
export function ScrollSpacer() {
  const spacerRef = useRef(null)

  useEffect(() => {
    // Lenis first, then the GSAP master timeline that reads its scroll —
    // the timeline's ScrollTrigger must exist before anything can drive it.
    const smoothScroll = createSmoothScroll(ScrollTrigger.update)

    // Read once per mount, not per tick — prefers-reduced-motion doesn't
    // change while the page is open.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Single source of truth for whether Lenis should be suspended —
    // both the intro rate-cap and the Snap 2 hard lock need it stopped,
    // and either can be active independently (e.g. the intro driver is
    // what CARRIES the visitor into the crossing that engages the lens
    // hold), so this centralizes the stop()/start() calls rather than
    // each mechanism calling them directly and risking a redundant or
    // out-of-order call.
    let lenisSuspended = false
    const syncScrollSuspension = () => {
      const shouldSuspend = introDriveActive || lensHoldActive
      if (shouldSuspend === lenisSuspended) return
      lenisSuspended = shouldSuspend
      if (shouldSuspend) smoothScroll.lenis.stop()
      else smoothScroll.lenis.start()
    }

    // --- Intro (t: 0 -> INTRO_ZONE_END_T) — hard rate cap ---
    let introDriveActive = false
    let introIntentDirection = 0
    let introIntentDecayTimeoutId = null
    let touchLastY = null

    const markIntroIntent = (deltaY) => {
      if (deltaY > 0) introIntentDirection = 1
      else if (deltaY < 0) introIntentDirection = -1
      clearTimeout(introIntentDecayTimeoutId)
      introIntentDecayTimeoutId = setTimeout(() => {
        introIntentDirection = 0
      }, INTRO_INTENT_DECAY_MS)
    }

    const onIntroWheel = (event) => {
      if (!introDriveActive) return
      event.preventDefault()
      markIntroIntent(event.deltaY)
    }
    const onIntroTouchStart = (event) => {
      touchLastY = event.touches[0]?.clientY ?? null
    }
    const onIntroTouchMove = (event) => {
      if (!introDriveActive || touchLastY === null) return
      event.preventDefault()
      const currentY = event.touches[0]?.clientY ?? touchLastY
      // Dragging a finger up the screen is the same gesture as a
      // positive wheel deltaY (scrolling forward) — match that sign.
      markIntroIntent(touchLastY - currentY)
      touchLastY = currentY
    }

    window.addEventListener('wheel', onIntroWheel, { capture: true, passive: false })
    window.addEventListener('touchstart', onIntroTouchStart, { capture: true, passive: true })
    window.addEventListener('touchmove', onIntroTouchMove, { capture: true, passive: false })

    const syncIntroZone = () => {
      if (prefersReducedMotion) return
      const inZone = scrollProgress.value < INTRO_ZONE_END_T && !lensHoldActive && !monitorLockActive
      if (inZone === introDriveActive) return
      introDriveActive = inZone
      if (!inZone) {
        introIntentDirection = 0
        clearTimeout(introIntentDecayTimeoutId)
      }
      syncScrollSuspension()
    }

    // Advances scrollProgress.value at a flat rate while introDriveActive
    // and the visitor is actively pushing a direction — see the
    // module-level doc comment above for the full mechanism.
    const introTick = (time, deltaMs) => {
      if (!introDriveActive || introIntentDirection === 0) return
      // Clamped so a tab coming back from being backgrounded (a huge
      // single deltaMs) can't produce one giant jump in progress.
      const deltaSeconds = Math.min(deltaMs, 100) / 1000
      const step = INTRO_MAX_RATE_PER_SECOND * deltaSeconds * introIntentDirection
      const next = THREE.MathUtils.clamp(scrollProgress.value + step, 0, INTRO_ZONE_END_T)
      if (next === scrollProgress.value) return
      scrollProgress.value = next
      const trigger = timeline.scrollTrigger
      if (trigger) {
        const targetScroll = trigger.start + (trigger.end - trigger.start) * next
        // force: true — Lenis's own scrollTo is a no-op while stopped
        // otherwise (confirmed against the installed package source),
        // and Lenis is deliberately kept stopped for this entire zone.
        smoothScroll.lenis.scrollTo(targetScroll, { immediate: true, force: true })
      }
    }
    gsap.ticker.add(introTick)

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

    // --- Snap 3 (Digital Monitor) — soft lock, unchanged from before ---
    let monitorLockActive = false
    let monitorLockTimeoutId = null

    const releaseMonitorLock = () => {
      if (!monitorLockActive) return
      monitorLockActive = false
      if (monitorLockTimeoutId) {
        clearTimeout(monitorLockTimeoutId)
        monitorLockTimeoutId = null
      }
      setScrollLocked(false)
    }

    const engageMonitorLock = () => {
      if (monitorLockActive || lensHoldActive) return
      monitorLockActive = true
      scrollProgress.value = MONITOR_SNAP_T
      setScrollLocked(true)
      monitorLockTimeoutId = setTimeout(releaseMonitorLock, SCROLL_LOCK_HOLD_MS)
    }

    // --- Snap 2 (Cinema Lens) — strict, bidirectional hard lock ---
    // `lastRawProgress` is the previous tick's real (unclamped) progress
    // — comparing it against the current tick's is what makes this a
    // genuine *crossing* check rather than a one-sided "is it past"
    // check, so it re-engages correctly on every pass through
    // `FILM_FOCUS_T`, forward or backward, not just the first one.
    let lastRawProgress = 0
    let lensHoldActive = false
    let lensHoldTimeoutId = null

    const onLensHoldWheel = (event) => {
      event.preventDefault()
      const WOBBLE_MAX = 0.015
      const WOBBLE_GAIN = WOBBLE_MAX / 300
      scrollLockWobble.value = THREE.MathUtils.clamp(
        scrollLockWobble.value + event.deltaY * WOBBLE_GAIN,
        -WOBBLE_MAX,
        WOBBLE_MAX,
      )
    }

    const releaseLensHold = () => {
      if (!lensHoldActive) return
      lensHoldActive = false
      if (lensHoldTimeoutId) {
        clearTimeout(lensHoldTimeoutId)
        lensHoldTimeoutId = null
      }
      window.removeEventListener('wheel', onLensHoldWheel, { capture: true })
      window.removeEventListener('touchmove', onLensHoldWheel, { capture: true })
      setScrollLocked(false)
      syncScrollSuspension()
      // Reset the crossing baseline to exactly the pinned point: the very
      // next tick's real progress will be on one side or the other of
      // FILM_FOCUS_T (wherever the visitor continues scrolling), and
      // since lastRawProgress now equals FILM_FOCUS_T exactly, neither
      // crossing condition below can fire on that first post-release
      // tick — otherwise release would immediately re-trigger itself.
      lastRawProgress = FILM_FOCUS_T
      // At exactly FILM_FOCUS_T the visitor is right on the intro zone's
      // boundary — re-evaluate immediately so scrolling back down into it
      // re-engages the rate cap on the very next tick rather than waiting
      // for a stray onUpdate.
      syncIntroZone()
    }

    const engageLensHold = (trigger) => {
      if (lensHoldActive) return
      lensHoldActive = true
      introDriveActive = false // the intro rate cap hands off to the hold, not both at once
      clearTimeout(introIntentDecayTimeoutId)
      introIntentDirection = 0
      scrollProgress.value = FILM_FOCUS_T

      // Pin the real scroll position to exactly FILM_FOCUS_T's pixel —
      // not wherever a fast scroll happened to overshoot to — so the
      // native scrollbar matches what the visitor sees. force: true since
      // this can fire while Lenis is already stopped (the intro rate cap
      // handing off directly into this hold) as well as while it's still
      // running (arriving via ordinary scroll) — Lenis's own scrollTo is
      // a no-op while stopped otherwise.
      const targetScroll = trigger.start + (trigger.end - trigger.start) * FILM_FOCUS_T
      smoothScroll.lenis.scrollTo(targetScroll, { immediate: true, force: true })
      syncScrollSuspension()
      window.addEventListener('wheel', onLensHoldWheel, { capture: true, passive: false })
      window.addEventListener('touchmove', onLensHoldWheel, { capture: true, passive: false })

      setScrollLocked(true)
      lensHoldTimeoutId = setTimeout(releaseLensHold, SCROLL_LOCK_HOLD_MS)
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
          onComplete: (self) => {
            if (Math.abs(self.progress - MONITOR_SNAP_T) < 0.001) engageMonitorLock()
          },
        },
        onUpdate: (self) => {
          // Snap 2: checked every tick (not just on scroll-stop) so a
          // fast, continuous scroll still gets caught exactly at
          // FILM_FOCUS_T instead of sailing through it — and checked as
          // a genuine crossing (FILM_FOCUS_T strictly between the last
          // tick's progress and this one) so it re-engages on every pass
          // through the point, forward or backward, not just the first.
          if (!lensHoldActive) {
            const crossedForward = lastRawProgress < FILM_FOCUS_T && self.progress >= FILM_FOCUS_T
            const crossedBackward = lastRawProgress > FILM_FOCUS_T && self.progress <= FILM_FOCUS_T
            if (crossedForward || crossedBackward) {
              lastRawProgress = self.progress
              engageLensHold(self)
              return
            }
          }
          lastRawProgress = self.progress

          if (monitorLockActive) {
            // Soft lock: scrollProgress.value stays pinned while real
            // scroll keeps moving underneath, purely to measure drift.
            if (Math.abs(self.progress - MONITOR_SNAP_T) > SCROLL_LOCK_OVERRIDE_DRIFT) {
              releaseMonitorLock()
              scrollProgress.value = self.progress
            }
            return
          }

          // While the intro driver is active it owns scrollProgress.value
          // (introTick, above) — the raw self.progress it produces via its
          // own force-scrollTo calls is expected to already match, but
          // this fallback must not overwrite a mid-tick driven value with
          // a stale or reentrant self.progress read.
          if (!lensHoldActive && !introDriveActive) {
            scrollProgress.value = self.progress
          }

          syncIntroZone()
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
      if (monitorLockTimeoutId) clearTimeout(monitorLockTimeoutId)
      if (lensHoldTimeoutId) clearTimeout(lensHoldTimeoutId)
      if (introIntentDecayTimeoutId) clearTimeout(introIntentDecayTimeoutId)
      gsap.ticker.remove(introTick)
      window.removeEventListener('wheel', onLensHoldWheel, { capture: true })
      window.removeEventListener('touchmove', onLensHoldWheel, { capture: true })
      window.removeEventListener('wheel', onIntroWheel, { capture: true })
      window.removeEventListener('touchstart', onIntroTouchStart, { capture: true })
      window.removeEventListener('touchmove', onIntroTouchMove, { capture: true })
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
