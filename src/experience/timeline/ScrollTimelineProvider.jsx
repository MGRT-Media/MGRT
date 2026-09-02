import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createSmoothScroll } from './smoothScroll.js'
import { setScrollLocked } from './scrollLockEvent.js'
import { onNavigateRequest } from './sectionNavigationEvent.js'
import {
  ESTABLISH_T,
  ESTABLISH_SNAP_CAPTURE_RADIUS,
  FILM_FOCUS_T,
  FILM_SNAP_CAPTURE_RADIUS,
  MONITOR_SNAP_T,
  MONITOR_SNAP_CAPTURE_RADIUS,
  SCROLL_LOCK_HOLD_MS,
  SCROLL_LOCK_OVERRIDE_DRIFT,
  INTRO_ALIGN_T,
  INTRO_CINEMATIC_MIN_DURATION_SECONDS,
  INTRO_CINEMATIC_MAX_DURATION_SECONDS,
  INTRO_INTENT_DECAY_MS,
  LOCK_CATCH_DURATION_SECONDS,
  LOCK_CATCH_EASE,
  SECTION_TARGETS,
  JUMP_MIN_DURATION_SECONDS,
  JUMP_MAX_DURATION_SECONDS,
  CHAPTER_GESTURE_THRESHOLD,
} from './filmActBeats.js'

gsap.registerPlugin(ScrollTrigger)

/**
 * Ease curve for direct-navigation jumps (below) — the same
 * ease-out-cubic shape `smoothScroll.js` already uses for Lenis's default
 * glide-to-rest, reused here rather than a second curve, so a nav-triggered
 * jump decelerates with the same weight as the rest of the experience.
 */
function easeSectionJump(t) {
  return 1 - (1 - t) ** 3
}

/**
 * Ease-in-out for the intro cinematic (below) — a genuine "wind up, glide,
 * settle" shape rather than the sharper ease-out every other tween in this
 * file uses, per explicit request that this specific move read as "slow,
 * smooth and deliberate... one continuous opening shot in a premium
 * commercial" — a cinematic camera move typically doesn't snap into motion
 * from a dead stop the way a UI transition does.
 */
function easeIntroCinematic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

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
 * inertial motion by Lenis (`smoothScroll.js`); `scrub` then adds its own
 * catch-up smoothing on top, so individual wheel notches/trackpad steps
 * absorb into one continuous, fluid motion rather than each nudging the
 * timeline forward in a visible little step. Was lowered from 1.5 to 1 in
 * an earlier round (alongside `cameraPath.js`'s asymmetric ease, since
 * fixed by later rounds), then raised back to 1.5 per a later explicit
 * follow-up that the overall scroll speed still felt too fast — it only
 * meaningfully affects the free-scroll segment between the Lens and
 * Monitor now, since the intro zone bypasses scrub entirely via its own
 * hard-capped driver (below).
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
 * Lock-entry "catch" (Snap 2 and 3) — per explicit follow-up report that
 * the previous instant `scrollProgress.value = <target>` jump on engaging
 * a lock felt mechanical/jarring. Both `engageLensHold` and
 * `engageMonitorLock` now tween into the pinned value over
 * `LOCK_CATCH_DURATION_SECONDS` with `LOCK_CATCH_EASE` (a decelerating
 * ease) rather than snapping in one frame, and the hold timer itself only
 * starts once that catch tween completes — so the whole "arrive, then
 * hold" sequence reads as one continuous deceleration into a rest rather
 * than a snap followed by a pause. For the Lens hold (which stops Lenis
 * outright), the tween's `onUpdate` mirrors each intermediate value onto
 * the real scroll position the same way `playIntroCinematic` does, so the
 * native scrollbar eases in step with the camera instead of jumping ahead
 * of it.
 *
 * Intro cinematic (`t: 0` through `INTRO_ALIGN_T`) — superseded the
 * previous continuous, input-driven hard-rate-cap mechanism entirely, per
 * explicit request that the opening no longer be continuously scroll-
 * driven at all: "ONE SCROLL -> ONE COMPLETE CAMERA MOVE... the scroll
 * should act as a trigger, not a continuous steering mechanism." The
 * first wheel/touch event triggers `playIntroCinematic(INTRO_ALIGN_T)` — a
 * single fixed-duration `smoothScroll.lenis.scrollTo(..., { force: true })`
 * tween, structurally identical to `navigateToSection`'s own jump
 * mechanism — and every event during that tween (`introCinematicActive`)
 * is swallowed outright, including further wheel input, direct nav
 * clicks, and chapter gestures (see `navigateToSection`'s own guard and
 * `isChapterTransitionLocked`). Once it completes, `chapterModeActive`
 * flips true and control hands off to the existing chapter-mode gesture
 * system for the next scroll — see `playIntroCinematic`'s own doc comment
 * for the full mechanism, including how reversing past Film replays this
 * same tween backward rather than resuming any form of continuous scroll.
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

    // Every scroll-position change in this experience now comes from a
    // controlled, `force: true` tween — the intro cinematic
    // (`playIntroCinematic`), a chapter-mode jump (`navigateToSection`), or
    // a lock catch-tween (`engageLensHold`/`engageMonitorLock`) — never
    // from free/continuous Lenis-driven scroll, per this round's "the
    // scroll should act as a trigger, not a continuous steering
    // mechanism." There is therefore no remaining case where Lenis should
    // run un-suspended: it's stopped once, for the entire mounted
    // lifetime of this component. `syncScrollSuspension` is kept as a
    // named function (rather than a bare `.stop()` call inlined at mount)
    // purely so every existing call site below — `releaseLensHold`,
    // `engageLensHold`, `cancelActiveDriversAndLocks`, etc. — keeps
    // working unmodified; each call is just an idempotent no-op after the
    // first.
    let lenisSuspended = false
    const syncScrollSuspension = () => {
      if (lenisSuspended) return
      lenisSuspended = true
      smoothScroll.lenis.stop()
    }

    // --- Chapter mode (Film and beyond) ---
    // `currentChapter` is the explicit, state-driven "which chapter is the
    // visitor viewing" the request asks for, rather than deriving it from
    // scroll pixel offsets — set at the moment the camera actually arrives
    // at a chapter (in engageLensHold/engageMonitorLock below and in
    // navigateToSection's onComplete), not from scrollProgress directly.
    // `chapterModeActive` is the ACT 0 vs. ACT 1+ mode switch itself: false
    // for the continuous intro, true from the instant the camera reaches
    // Film onward. Campaigns/Return are intentionally absent from
    // CHAPTER_ORDER — see SECTION_TARGETS' own doc comment for why.
    let currentChapter = 'intro'
    let chapterModeActive = false
    const CHAPTER_ORDER = ['film', 'digital']

    // --- Direct navigation (side nav clicks) ---
    // Set for the duration of a nav-triggered jump; suppresses the
    // intro-zone driver and the Lens crossing-detection lock below so the
    // camera can physically travel *through* an intermediate landmark
    // without stopping or firing its presentation trigger, per explicit
    // request ("the camera can physically travel through the environment,
    // but it should not stop and trigger the Film or Digital presentation
    // sequences on the way"). `jumpToken` guards a jump's own `onComplete`
    // against firing after a newer click has superseded it.
    let isDirectJumpActive = false
    let jumpToken = 0

    // --- Intro cinematic (t: 0 <-> INTRO_ALIGN_T) — one-shot auto-play ---
    // `introCinematicActive` is set for the tween's full duration and is
    // this mechanism's own "isTransitioning" guard, mirroring
    // `isDirectJumpActive`'s role for nav jumps. `introCinematicPlayed`
    // flips true once the FORWARD play (t: 0 -> INTRO_ALIGN_T) completes —
    // from then on, further wheel/touch input is chapter-mode's job, not
    // this trigger's (see `onIntroTriggerWheel` below, defined once
    // `playIntroCinematic` itself exists further down, after `timeline`).
    let introCinematicActive = false
    let introCinematicPlayed = false

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
      // Arriving at Digital — already true once Film was reached, but set
      // again here so this also covers a hypothetical future direct arrival
      // that skips Film's own engage path.
      currentChapter = 'digital'
      chapterModeActive = true
      setScrollLocked(true)
      gsap.to(scrollProgress, {
        value: MONITOR_SNAP_T,
        duration: LOCK_CATCH_DURATION_SECONDS,
        ease: LOCK_CATCH_EASE,
        onComplete: () => {
          monitorLockTimeoutId = setTimeout(releaseMonitorLock, SCROLL_LOCK_HOLD_MS)
        },
      })
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
    }

    const engageLensHold = (trigger) => {
      if (lensHoldActive) return
      lensHoldActive = true
      // FILM IS THE MODE SWITCH — the instant the camera reaches Film,
      // whether via the intro cinematic's own hand-off into chapter mode
      // or a direct nav-click jump, the experience is in chapter mode (see
      // CHAPTER_ORDER and the gesture handlers below). Reversed only by
      // the chapter-gesture handler's own backward-exit-from-Film case
      // (which replays the intro cinematic), or by clicking Intro.
      currentChapter = 'film'
      chapterModeActive = true

      // Stop Lenis before the catch tween starts, not after — no further
      // wheel/touch input should move the page even during the ease-in.
      syncScrollSuspension()
      window.addEventListener('wheel', onLensHoldWheel, { capture: true, passive: false })
      window.addEventListener('touchmove', onLensHoldWheel, { capture: true, passive: false })
      setScrollLocked(true)

      const scrollRange = trigger.end - trigger.start
      gsap.to(scrollProgress, {
        value: FILM_FOCUS_T,
        duration: LOCK_CATCH_DURATION_SECONDS,
        ease: LOCK_CATCH_EASE,
        onUpdate: () => {
          // Mirror each intermediate value onto the real scroll position
          // so the native scrollbar eases in step with the camera instead
          // of jumping ahead of it. force: true since Lenis is already
          // stopped by this point — its own scrollTo is a no-op while
          // stopped otherwise.
          const targetScroll = trigger.start + scrollRange * scrollProgress.value
          smoothScroll.lenis.scrollTo(targetScroll, { immediate: true, force: true })
        },
        onComplete: () => {
          lensHoldTimeoutId = setTimeout(releaseLensHold, SCROLL_LOCK_HOLD_MS)
        },
      })
    }

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: spacerRef.current,
        scroller: window,
        start: 'top top',
        end: 'bottom bottom',
        // Raised from 1 per explicit follow-up ("scroll speed... still
        // too fast") — only meaningfully affects the free-scroll segment
        // between the Lens and Monitor (the intro zone bypasses scrub
        // entirely via its own hard-capped driver above), giving that
        // pull-back-and-pan a touch more of its own catch-up lag/weight.
        scrub: 1.5,
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
          // `!introCinematicActive` matters specifically for the REVERSE
          // intro cinematic (Film -> t: 0): that tween's own progress
          // legitimately crosses back through FILM_FOCUS_T on its way
          // down, and without this guard that crossing would wrongly
          // re-engage the lens hold mid-reverse-play.
          if (!lensHoldActive && !isDirectJumpActive && !introCinematicActive) {
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

          if (!lensHoldActive) {
            scrollProgress.value = self.progress
          }
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

    // --- Direct navigation (side nav clicks) ---
    // Tears down whichever driver/lock is currently active so a jump
    // always starts from a clean slate, reusing each mechanism's own
    // release function rather than duplicating its cleanup (listener
    // removal, timers, etc).
    const cancelActiveDriversAndLocks = () => {
      if (lensHoldActive) releaseLensHold()
      if (monitorLockActive) releaseMonitorLock()
      scrollLockWobble.value = 0
      gsap.killTweensOf(scrollProgress)
      syncScrollSuspension()
    }

    // Drives a smooth camera jump to `sectionKey`'s target (SECTION_TARGETS,
    // filmActBeats.js) over the SAME physical camera track scroll already
    // uses — reuses Lenis's own scrollTo tweening rather than a second
    // tween system, so the jump reads as the same camera physically moving
    // through the same environment, not a teleport. Campaigns/Return have
    // no real landmark yet (see SECTION_TARGETS' own doc comment) and are
    // silently a no-op here — SectionIndicator.jsx keeps their marks
    // visually consistent but never calls this for them... except it does
    // call requestNavigate unconditionally, so the guard lives here too as
    // a second line of defense.
    const navigateToSection = (sectionKey) => {
      const targetT = SECTION_TARGETS[sectionKey]
      if (targetT === undefined) return
      // The intro cinematic (below) is this file's own one-shot, uninterruptible
      // move — per explicit request, input during it must not "trigger another
      // section." A nav click landing mid-tween is exactly that case.
      if (introCinematicActive) return
      const trigger = timeline.scrollTrigger
      if (!trigger) return

      // Bump the token before tearing anything down so a rapid second
      // click cleanly supersedes the first — its onComplete below checks
      // this and no-ops if it's since gone stale. Lenis's own scrollTo
      // also interrupts any in-flight tween of its own when called again,
      // so two rapid jumps never fight over the actual scroll position.
      const token = ++jumpToken
      cancelActiveDriversAndLocks()
      isDirectJumpActive = true

      const startT = scrollProgress.value
      const distance = Math.abs(targetT - startT)
      const duration = THREE.MathUtils.clamp(
        JUMP_MIN_DURATION_SECONDS + distance * (JUMP_MAX_DURATION_SECONDS - JUMP_MIN_DURATION_SECONDS),
        JUMP_MIN_DURATION_SECONDS,
        JUMP_MAX_DURATION_SECONDS,
      )
      const scrollRange = trigger.end - trigger.start
      const targetScroll = trigger.start + scrollRange * targetT

      smoothScroll.lenis.scrollTo(targetScroll, {
        // prefers-reduced-motion: jump straight there rather than tweening,
        // consistent with playIntroCinematic's own handling of the setting
        // elsewhere in this file.
        immediate: prefersReducedMotion,
        duration,
        easing: easeSectionJump,
        // Lenis's own scrollTo is a no-op while stopped unless forced —
        // cancelActiveDriversAndLocks() should already have released any
        // stop via syncScrollSuspension(), but this is a safety net against
        // a stale suspended state at the exact moment of the call.
        force: true,
        onComplete: () => {
          if (token !== jumpToken) return // superseded by a newer click
          isDirectJumpActive = false
          // Matches releaseLensHold's own reset: pins the crossing-
          // detection baseline to exactly the arrival point so the very
          // next tick can't misread a stale gap as a fresh crossing.
          lastRawProgress = targetT
          scrollProgress.value = targetT
          if (sectionKey === 'film') engageLensHold(trigger)
          else if (sectionKey === 'digital') engageMonitorLock()
          else {
            // 'intro' — also exits chapter mode if the visitor was in it
            // (e.g. clicking the Intro mark while at Film/Digital), so
            // `currentChapter`/scroll-suspension stay synchronized with
            // where the camera actually landed. Note this lands at t: 0
            // exactly (`SECTION_TARGETS.intro`), past the exterior orbit
            // this round added — the "one-shot forward play" only exists
            // to get FROM here TO `INTRO_ALIGN_T`, so landing back at the
            // literal start correctly requires the intro cinematic to be
            // played again before chapter mode can resume, hence resetting
            // `introCinematicPlayed` here too.
            currentChapter = 'intro'
            chapterModeActive = false
            introCinematicPlayed = false
            syncScrollSuspension()
          }
        },
      })
    }

    // --- Intro cinematic playback ---
    // The actual one-shot mover, structurally parallel to `navigateToSection`
    // above (same `smoothScroll.lenis.scrollTo(..., { force: true })`
    // mechanism, so `scrollProgress.value` tracks the real scroll position
    // through `timeline`'s own `onUpdate` fallback exactly like every other
    // jump in this file — no second, parallel way of driving progress).
    // `targetT` is either `INTRO_ALIGN_T` (the forward entrance, called from
    // `onIntroTriggerWheel`/`onIntroTriggerTouchMove` below) or `0` (the
    // reverse replay, called from `goToChapterIndex`'s nextIndex < 0 case).
    const playIntroCinematic = (targetT) => {
      if (introCinematicActive) return
      const trigger = timeline.scrollTrigger
      if (!trigger) return
      introCinematicActive = true
      gsap.killTweensOf(scrollProgress)
      syncScrollSuspension()

      const startT = scrollProgress.value
      const distance = Math.abs(targetT - startT)
      const duration = THREE.MathUtils.clamp(
        INTRO_CINEMATIC_MIN_DURATION_SECONDS * (distance / INTRO_ALIGN_T),
        INTRO_CINEMATIC_MIN_DURATION_SECONDS,
        INTRO_CINEMATIC_MAX_DURATION_SECONDS,
      )
      const scrollRange = trigger.end - trigger.start
      const targetScroll = trigger.start + scrollRange * targetT

      smoothScroll.lenis.scrollTo(targetScroll, {
        immediate: prefersReducedMotion,
        duration,
        easing: easeIntroCinematic,
        force: true,
        onComplete: () => {
          introCinematicActive = false
          scrollProgress.value = targetT
          lastRawProgress = targetT
          if (targetT === 0) {
            // Reverse play landed back at the literal start — ready for
            // the forward cinematic to be triggered again.
            currentChapter = 'intro'
            chapterModeActive = false
            introCinematicPlayed = false
          } else {
            // Forward play landed at the exterior alignment point, already
            // on the straight lens axis — hand off to the EXISTING
            // chapter-mode gesture system for the next scroll, per
            // explicit "restore normal chapter-based navigation." The
            // very next chapter gesture resolves to 'film'
            // (`CHAPTER_ORDER.indexOf('intro')` is -1, so `goToNextChapter`
            // steps to index 0) and travels the rest of the way — already
            // guaranteed a straight line — via the unmodified
            // `navigateToSection('film')` -> `engageLensHold` path.
            introCinematicPlayed = true
            chapterModeActive = true
          }
        },
      })
    }

    // First wheel/touch gesture, and ONLY the first, triggers the one-shot
    // forward play — every event afterward (including ones that arrive
    // WHILE the tween is running) is swallowed here, per explicit "should
    // NOT speed up/interrupt/change/skip... allow the movement to complete
    // naturally." Once `introCinematicPlayed` flips true, chapter mode's
    // own listeners (below) take over entirely; this listener goes
    // permanently quiet from then on (until/unless a reverse play resets
    // it, per `playIntroCinematic`'s own `onComplete`).
    const onIntroTriggerWheel = (event) => {
      if (currentChapter !== 'intro' || introCinematicPlayed) return
      event.preventDefault()
      playIntroCinematic(INTRO_ALIGN_T)
    }
    const onIntroTriggerTouchMove = (event) => {
      if (currentChapter !== 'intro' || introCinematicPlayed) return
      event.preventDefault()
      playIntroCinematic(INTRO_ALIGN_T)
    }

    window.addEventListener('wheel', onIntroTriggerWheel, { capture: true, passive: false })
    window.addEventListener('touchmove', onIntroTriggerTouchMove, { capture: true, passive: false })

    // --- Chapter mode input (Film and beyond) ---
    // Mirrors the intro zone's own "fully intercept input, drive state
    // ourselves" pattern (always-attached capture-phase listeners,
    // `preventDefault` on every event) rather than letting native/Lenis
    // scroll move at all once in chapter mode — the wheel/trackpad/touch
    // becomes a pure "advance one chapter" trigger, not something that
    // moves a scroll position, per explicit request.
    //
    // `isChapterTransitionLocked` IS this file's `isTransitioning` guard:
    // it reuses `isDirectJumpActive` (already set for a jump's full
    // duration by navigateToSection, whether the jump came from a gesture
    // or a nav click) rather than a second, parallel lock flag, plus the
    // Lens/Monitor locks' own arrival-pause windows (`lensHoldActive`/
    // `monitorLockActive`) so a gesture can't fire while the camera is
    // still settling into a chapter it just reached. A fast/repeated
    // wheel burst can only ever accumulate into ONE `goToNextChapter()`
    // call: the very first crossing of `CHAPTER_GESTURE_THRESHOLD` calls
    // `navigateToSection`, which sets `isDirectJumpActive` synchronously
    // before returning — so by the time the burst's next event arrives
    // (JS is single-threaded; events are processed one at a time), the
    // lock check above already short-circuits it. This is what prevents
    // "Film -> Campaigns" when the intended gesture was "Film -> Digital".
    let chapterGestureAccum = 0
    let chapterGestureDecayTimeoutId = null
    let chapterTouchLastY = null

    const isChapterTransitionLocked = () =>
      isDirectJumpActive || lensHoldActive || monitorLockActive || introCinematicActive

    const resetChapterGesture = () => {
      chapterGestureAccum = 0
      clearTimeout(chapterGestureDecayTimeoutId)
    }

    // nextIndex < 0 (stepping back from Film) replays the intro cinematic
    // in reverse — Film all the way back to t: 0, one continuous shot —
    // rather than a discrete jump-cut, since there is no longer a
    // continuous intro driver to hand off to (this round replaced it
    // entirely with the one-shot `playIntroCinematic`, which is
    // bidirectional by construction: it's driven by the exact same
    // `sampleCameraPath`, a pure function of progress).
    const goToChapterIndex = (nextIndex) => {
      if (nextIndex < 0) {
        playIntroCinematic(0)
        return
      }
      if (nextIndex >= CHAPTER_ORDER.length) return // Digital is the last reachable chapter for now
      navigateToSection(CHAPTER_ORDER[nextIndex])
    }

    const goToNextChapter = () => goToChapterIndex(CHAPTER_ORDER.indexOf(currentChapter) + 1)
    const goToPreviousChapter = () => goToChapterIndex(CHAPTER_ORDER.indexOf(currentChapter) - 1)

    const handleChapterGesture = (deltaY) => {
      if (isChapterTransitionLocked()) return
      chapterGestureAccum += deltaY
      clearTimeout(chapterGestureDecayTimeoutId)
      chapterGestureDecayTimeoutId = setTimeout(resetChapterGesture, INTRO_INTENT_DECAY_MS)
      if (chapterGestureAccum > CHAPTER_GESTURE_THRESHOLD) {
        resetChapterGesture()
        goToNextChapter()
      } else if (chapterGestureAccum < -CHAPTER_GESTURE_THRESHOLD) {
        resetChapterGesture()
        goToPreviousChapter()
      }
    }

    const onChapterWheel = (event) => {
      if (!chapterModeActive) return
      event.preventDefault()
      handleChapterGesture(event.deltaY)
    }
    const onChapterTouchStart = (event) => {
      if (!chapterModeActive) return
      chapterTouchLastY = event.touches[0]?.clientY ?? null
    }
    const onChapterTouchMove = (event) => {
      if (!chapterModeActive || chapterTouchLastY === null) return
      event.preventDefault()
      const currentY = event.touches[0]?.clientY ?? chapterTouchLastY
      handleChapterGesture(chapterTouchLastY - currentY)
      chapterTouchLastY = currentY
    }

    window.addEventListener('wheel', onChapterWheel, { capture: true, passive: false })
    window.addEventListener('touchstart', onChapterTouchStart, { capture: true, passive: true })
    window.addEventListener('touchmove', onChapterTouchMove, { capture: true, passive: false })

    const unsubscribeNavigate = onNavigateRequest(navigateToSection)

    return () => {
      unsubscribeNavigate()
      cancelAnimationFrame(raf)
      if (monitorLockTimeoutId) clearTimeout(monitorLockTimeoutId)
      if (lensHoldTimeoutId) clearTimeout(lensHoldTimeoutId)
      if (chapterGestureDecayTimeoutId) clearTimeout(chapterGestureDecayTimeoutId)
      gsap.killTweensOf(scrollProgress)
      window.removeEventListener('wheel', onLensHoldWheel, { capture: true })
      window.removeEventListener('touchmove', onLensHoldWheel, { capture: true })
      window.removeEventListener('wheel', onIntroTriggerWheel, { capture: true })
      window.removeEventListener('touchmove', onIntroTriggerTouchMove, { capture: true })
      window.removeEventListener('wheel', onChapterWheel, { capture: true })
      window.removeEventListener('touchstart', onChapterTouchStart, { capture: true })
      window.removeEventListener('touchmove', onChapterTouchMove, { capture: true })
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
