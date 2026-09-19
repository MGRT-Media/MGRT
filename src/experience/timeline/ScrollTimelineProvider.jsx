import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createSmoothScroll } from './smoothScroll.js'
import { setScrollLocked } from './scrollLockEvent.js'
import { onNavigateRequest } from './sectionNavigationEvent.js'
import { isExperienceRevealed, onExperienceRevealed, recordStartupIntent, takeStartupIntent } from '../loading/startupCover.js'
import {
  FILM_FOCUS_T,
  MONITOR_SNAP_T,
  SCROLL_LOCK_HOLD_MS,
  SCROLL_LOCK_OVERRIDE_DRIFT,
  INTRO_ALIGN_T,
  INTRO_CINEMATIC_MIN_DURATION_SECONDS,
  INTRO_CINEMATIC_MAX_DURATION_SECONDS,
  INTRO_TO_FILM_DURATION_SECONDS,
  INTRO_INTENT_DECAY_MS,
  LOCK_CATCH_DURATION_SECONDS,
  LOCK_CATCH_EASE,
  SECTION_TARGETS,
  JUMP_MIN_DURATION_SECONDS,
  JUMP_MAX_DURATION_SECONDS,
  CHAPTER_GESTURE_THRESHOLD,
  HERO_T,
  HERO_TRAVERSAL_DURATION_SECONDS,
  DIGITAL_EXIT_T,
  JOURNEY_END_T,
} from './filmActBeats.js'
import { cancelSectionFlight, requestSectionFlight } from './sectionFlightRequest.js'
import { ensureSectionAssets, sectionAssetsReady } from '../loading/deferredAssets.js'

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
 * Progress ranges the camera path paces by itself — `cameraPath.js`'s
 * `GLIDES` ease each of these once over its measured length. A jump must move
 * progress through them at an even rate: any easing applied on top compounds
 * with the path's own, and the ease-out every other jump uses crowded both
 * moves into a burst at the start.
 */
const GLIDE_LEGS = [
  { from: INTRO_ALIGN_T, to: FILM_FOCUS_T, seconds: INTRO_TO_FILM_DURATION_SECONDS },
  { from: MONITOR_SNAP_T, to: HERO_T, seconds: HERO_TRAVERSAL_DURATION_SECONDS },
]
const LEG_BOUNDARIES = [INTRO_ALIGN_T, FILM_FOCUS_T, MONITOR_SNAP_T, HERO_T]
const PROGRESS_EPSILON = 1e-4

// Scroll pixels round to a few ten-thousandths of progress; a section flight
// treats anything past this as the visitor scrolling (see `flyToSection`).
const FLIGHT_SCROLL_TOLERANCE = 0.003

function easeLinear(t) {
  return t
}

/**
 * A jump that starts part-way through a glide — the visitor changed their mind
 * mid-move — still has to leave from rest, or the camera's target would flip
 * from full speed one way to full speed the other in a single frame.
 */
function easeFromRest(t) {
  return t * t * (3 - 2 * t)
}

function jumpDuration(distance) {
  return THREE.MathUtils.clamp(
    JUMP_MIN_DURATION_SECONDS + distance * (JUMP_MAX_DURATION_SECONDS - JUMP_MIN_DURATION_SECONDS),
    JUMP_MIN_DURATION_SECONDS,
    JUMP_MAX_DURATION_SECONDS,
  )
}

/**
 * Splits a jump at the glide boundaries it crosses.
 *
 * Inside a glide, progress moves evenly for that glide's own duration (scaled
 * by how much of it is covered). Everything else keeps the established
 * distance-scaled ease-out. Neighbouring pieces meet at keyframes where the path itself is at
 * rest, so chaining them adds no visible seam.
 */
function planJump(startT, targetT) {
  const direction = Math.sign(targetT - startT)
  const cuts = LEG_BOUNDARIES.filter((t) => (t - startT) * direction > PROGRESS_EPSILON && (targetT - t) * direction > PROGRESS_EPSILON)
  if (direction < 0) cuts.reverse()
  const points = [startT, ...cuts, targetT]
  const steps = []
  for (let k = 0; k < points.length - 1; k += 1) {
    const from = points[k]
    const to = points[k + 1]
    const lo = Math.min(from, to)
    const hi = Math.max(from, to)
    if (hi - lo <= PROGRESS_EPSILON) {
      steps.push({ to, duration: 0, easing: easeLinear })
      continue
    }
    const leg = GLIDE_LEGS.find((g) => lo >= g.from - PROGRESS_EPSILON && hi <= g.to + PROGRESS_EPSILON)
    if (leg) {
      const startsAtBoundary = LEG_BOUNDARIES.some((t) => Math.abs(t - from) <= PROGRESS_EPSILON)
      steps.push({
        to,
        duration: (leg.seconds * (hi - lo)) / (leg.to - leg.from),
        easing: startsAtBoundary ? easeLinear : easeFromRest,
      })
    } else {
      const previous = steps[steps.length - 1]
      if (previous?.distance !== undefined) {
        previous.to = to
        previous.distance += hi - lo
        previous.duration = jumpDuration(previous.distance)
      } else {
        steps.push({ to, distance: hi - lo, duration: jumpDuration(hi - lo), easing: easeSectionJump })
      }
    }
  }
  return steps
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
 * Shared mutable progress value (0 to `JOURNEY_END_T`), written by the GSAP/ScrollTrigger
 * master timeline below and read directly inside R3F's `useFrame` loop
 * (see `ScrollCameraRig.jsx`). A plain object reference — not React state
 * — so scroll updates never trigger a React re-render or component state
 * dispatch, per technical-architecture.md §7.
 */
export const scrollProgress = { value: 0 }
if (import.meta.env.DEV) window.__sp = scrollProgress // TEMP DEBUG SCAFFOLD

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

// Total scroll distance, as a multiple of the cached viewport height (not raw
// vh) so it doesn't shift when the mobile browser chrome resizes. Three
// viewport heights used to cover the whole 0-1 timeline; the journey now ends
// at the hero (`JOURNEY_END_T`), so the page is shortened in proportion and
// every remaining section keeps exactly the scroll distance it had.
const SCROLL_LENGTH_MULTIPLIER = 3 * JOURNEY_END_T

/**
 * The page's scroll range maps onto the journey, 0 to `JOURNEY_END_T`: the
 * bottom of the page is the hero, and there is no scroll beyond it.
 */
function progressFromScrollFraction(fraction) {
  return fraction * JOURNEY_END_T
}

function scrollForProgress(trigger, progress) {
  return trigger.start + (trigger.end - trigger.start) * (progress / JOURNEY_END_T)
}

/**
 * Renders the scroll-height spacer and owns the single master GSAP
 * timeline: a `gsap.timeline({ scrollTrigger: { scrub, ... } })` whose
 * ScrollTrigger drives `scrollProgress.value` from 0 to `JOURNEY_END_T` (the
 * hero) across the spacer's height. Raw wheel/touch input is first normalized into smooth,
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
 * "3 distinct, locked snap/pause positions" from an earlier round: Snap 1
 * (Studio Scene establish, `ESTABLISH_T`, `filmActBeats.js`), Snap 2
 * (Cinema Lens, `FILM_FOCUS_T`), Snap 3 (Digital Monitor, `MONITOR_SNAP_T`).
 * GSAP's own `scrollTrigger.snap` config used to implement these by pulling
 * the resting scroll position onto whichever point the user stopped
 * scrolling near — removed this round (see the `timeline` ScrollTrigger's
 * own comment below for why it became actively harmful once every scroll
 * change became a controlled tween rather than organic scrolling). Snap 2
 * and 3 are unaffected: both are still real, reversible locks, just
 * engaged explicitly (`engageLensHold`'s crossing-detection in `onUpdate`,
 * `engageMonitorLock` from `navigateToSection`'s own `onComplete`) instead
 * of via GSAP's native mechanism. Snap 1 has no engage/lock behavior of
 * its own — it was purely GSAP's snap magnetically pulling the resting
 * position toward it, which no longer has any equivalent now that no
 * scroll ever "rests" at an arbitrary organic position in the first place.
 *
 * Snap 3 (Digital Monitor) keeps the softer "freeze scrollProgress.value,
 * let real scroll keep moving underneath" lock from the previous round.
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
    /**
     * No input reaches the experience before it is on screen.
     *
     * This mounts with the scene, which then warms up behind the startup
     * cover for up to a second or so. A wheel, swipe or scroll key in
     * that window used to reach Lenis and the intro trigger as normal, so the
     * camera set off where nobody could see it and the reveal opened part-way
     * through the flight. Registered first, in the capture phase on `window`,
     * so it runs before every other listener here (Lenis's included) and
     * stops the event outright until the reveal.
     */
    const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '])
    // Held, not discarded: `startupCover.js` has already recorded what the
    // gesture asked for, and it is replayed once the scene is revealed
    // (`replayHeldIntent`, below). Holding it is what keeps the camera behind
    // the opening image on the pose the image shows.
    const holdInputUntilRevealed = (event) => {
      if (isExperienceRevealed()) return
      // Keys still work on the startup cover's own retry button.
      if (event.type === 'keydown' && (!SCROLL_KEYS.has(event.key) || event.target?.closest?.('#startup-cover'))) return
      if (event.cancelable) event.preventDefault()
      event.stopImmediatePropagation()
    }
    const HELD_INPUT = ['wheel', 'touchmove', 'keydown']
    HELD_INPUT.forEach((type) => window.addEventListener(type, holdInputUntilRevealed, { capture: true, passive: false }))

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
    // Film onward. `hero`, the MGRT wordmark, is the last chapter.
    let currentChapter = 'intro'
    let chapterModeActive = false
    const CHAPTER_ORDER = ['film', 'digital', 'hero']

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
    // The destination of the section flight in progress, or null — see
    // `flyToSection`. Declared up here because the scroll trigger's `onUpdate`
    // reads it and can run as soon as the trigger exists.
    let flightTargetT = null
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
          smoothScroll.lenis.scrollTo(scrollForProgress(trigger, scrollProgress.value), { immediate: true, force: true })
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
        // Scrub smoothing, unchanged. `snap` was removed this round: every
        // scroll-position change now comes from an explicit controlled
        // tween (`playIntroCinematic`/`navigateToSection`/lock catch-
        // tweens), never organic user scrolling, so GSAP's native "pull
        // the resting position onto the nearest snap point once scrolling
        // stops" behaviour had no legitimate remaining case to serve — and
        // was actively harmful: it doesn't distinguish "the user stopped
        // scrolling" from "a script's tween just finished," so once
        // `playIntroCinematic` settled at `INTRO_ALIGN_T` (0.12), which
        // sits inside `ESTABLISH_T`'s own `ESTABLISH_SNAP_CAPTURE_RADIUS`
        // (0.15 ± 0.05), this fired a SECOND, unrequested automatic nudge
        // toward 0.15 — a real, if small, violation of "the camera should
        // pause and wait for a second user scroll," per explicit report.
        // The `MONITOR_SNAP_T` `onComplete` hook this config also carried
        // is likewise redundant: `navigateToSection`'s own `onComplete`
        // already calls `engageMonitorLock()` explicitly on every path
        // that can reach Digital.
        // 1.5 -> 0.5. This was the largest single source of latency in the
        // chain and it was redundant: Lenis already smooths the input and the
        // camera's own damp smooths the output, so a 1.5s catch-up here was a
        // third pass over motion that had been smoothed twice already. At 0.5
        // it does what scrub is for — keeping the timeline synchronised with
        // the scroller — without being a smoothing layer in its own right.
        scrub: 0.5,
        onUpdate: (self) => {
          const progress = progressFromScrollFraction(self.progress)
          // Scroll moving away from a section flight's destination while it
          // flies can only be the visitor scrolling (the flight put scroll
          // there itself). Scroll wins: the flight stops where the camera is
          // and the journey carries on from there — see `interruptSectionFlight`.
          if (flightTargetT !== null && Math.abs(progress - flightTargetT) > FLIGHT_SCROLL_TOLERANCE) {
            interruptSectionFlight(progress)
          }

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
            const crossedForward = lastRawProgress < FILM_FOCUS_T && progress >= FILM_FOCUS_T
            const crossedBackward = lastRawProgress > FILM_FOCUS_T && progress <= FILM_FOCUS_T
            if (crossedForward || crossedBackward) {
              lastRawProgress = progress
              engageLensHold(self)
              return
            }
          }
          lastRawProgress = progress

          if (monitorLockActive) {
            // Soft lock: scrollProgress.value stays pinned while real
            // scroll keeps moving underneath, purely to measure drift.
            if (Math.abs(progress - MONITOR_SNAP_T) > SCROLL_LOCK_OVERRIDE_DRIFT) {
              releaseMonitorLock()
              scrollProgress.value = progress
            }
            return
          }

          if (!lensHoldActive) {
            scrollProgress.value = progress
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
    // through the same environment, not a teleport. Chapter gestures use
    // this; side-navigation clicks fly instead (`flyToSection`). A key with no
    // SECTION_TARGETS entry is a no-op.
    // Runs `planJump`'s steps back to back. Every step checks the token, so a
    // newer jump supersedes this one between steps as well as within them.
    const runJump = (trigger, token, targetT, onArrive) => {
      const steps = planJump(scrollProgress.value, targetT)
      const runStep = (index) => {
        if (token !== jumpToken) return
        if (index === steps.length) {
          onArrive()
          return
        }
        const step = steps[index]
        smoothScroll.lenis.scrollTo(scrollForProgress(trigger, step.to), {
          // prefers-reduced-motion: jump straight there rather than tweening,
          // consistent with playIntroCinematic's own handling of the setting.
          immediate: prefersReducedMotion || step.duration === 0,
          duration: step.duration,
          easing: step.easing,
          // Lenis's own scrollTo is a no-op while stopped unless forced —
          // cancelActiveDriversAndLocks() should already have released any
          // stop via syncScrollSuspension(), but this is a safety net against
          // a stale suspended state at the exact moment of the call.
          force: true,
          onComplete: () => runStep(index + 1),
        })
      }
      runStep(0)
    }

    /**
     * Holds a move to a section until that section's close-up can be drawn at
     * full quality — see `ensureSectionAssets`.
     *
     * Normally there is nothing to wait for and `start` runs on the spot, so
     * this is invisible: the check is a boolean, not a promise. When the wait
     * does happen the visitor keeps the composition they are already looking
     * at, which is a complete frame, instead of flying to a close-up of a
     * texture that has not arrived. A later request supersedes an earlier
     * wait, so clicking twice never runs two moves.
     */
    let sectionGateTicket = 0
    const whenSectionReady = (sectionKey, start) => {
      if (sectionAssetsReady(sectionKey)) {
        start()
        return
      }
      const ticket = ++sectionGateTicket
      ensureSectionAssets(sectionKey).then(() => {
        if (ticket === sectionGateTicket) start()
      })
    }

    const navigateToSection = (sectionKey) => whenSectionReady(sectionKey, () => startNavigateToSection(sectionKey))

    const startNavigateToSection = (sectionKey) => {
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

      // Paced by `planJump`: the two glides at their own even rate, everything
      // else with the distance-scaled ease-out.
      runJump(trigger, token, targetT, () => arriveAtSection(sectionKey, trigger))
    }

    // What arriving at a section means, however the camera got there — a
    // chapter gesture's journey or a section flight.
    const arriveAtSection = (sectionKey, trigger) => {
      const targetT = SECTION_TARGETS[sectionKey]
      isDirectJumpActive = false
      // Matches releaseLensHold's own reset: pins the crossing-
      // detection baseline to exactly the arrival point so the very
      // next tick can't misread a stale gap as a fresh crossing.
      lastRawProgress = targetT
      scrollProgress.value = targetT
      if (sectionKey === 'film') engageLensHold(trigger)
      else if (sectionKey === 'digital') engageMonitorLock()
      else if (sectionKey === 'hero') {
        // The hero has no lock of its own: it is the end of the journey, and
        // the camera simply rests there. Chapter state still has to be
        // recorded, or a subsequent backward gesture would compute the wrong
        // neighbour.
        currentChapter = 'hero'
        chapterModeActive = true
      } else {
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
    }

    // --- Section flights (side navigation clicks) ---
    // A click flies straight to the section rather than travelling the journey
    // through every section in between; `ScrollCameraRig` flies the camera
    // (`sectionFlightRoute.js`) and this keeps everything else in step.
    //
    // Scroll goes to the destination IMMEDIATELY, before the camera moves. That
    // is what keeps scroll-driven and flight-driven updates from competing:
    // nothing about the scroll changes while the camera travels, the side
    // navigation shows the destination from the click, the destination's
    // assets start loading, and on arrival manual scrolling simply continues
    // from the section. Content that would react to that jump reads content
    // progress (`contentProgress.js`), which follows the flight instead.
    const flyToSection = (sectionKey) => whenSectionReady(sectionKey, () => startFlyToSection(sectionKey))

    const startFlyToSection = (sectionKey) => {
      const targetT = SECTION_TARGETS[sectionKey]
      if (targetT === undefined) return
      // Same rule as a chapter jump: the intro cinematic is uninterruptible.
      if (introCinematicActive) return
      const trigger = timeline.scrollTrigger
      if (!trigger) return

      // A click mid-flight supersedes that flight's arrival; the rig redirects
      // the camera from wherever it is.
      const token = ++jumpToken
      cancelActiveDriversAndLocks()
      isDirectJumpActive = true
      flightTargetT = targetT
      lastRawProgress = targetT
      smoothScroll.lenis.scrollTo(scrollForProgress(trigger, targetT), { immediate: true, force: true })
      scrollProgress.value = targetT

      requestSectionFlight(targetT, {
        immediate: prefersReducedMotion,
        onArrive: () => {
          if (token !== jumpToken) return
          flightTargetT = null
          isDirectJumpActive = false
          arriveAtSection(sectionKey, trigger)
        },
      })
    }

    // The visitor scrolled while a flight was travelling. The camera stops
    // flying and scroll takes it from where it is; chapter state follows the
    // scroll position so the next gesture steps from there.
    const interruptSectionFlight = (progress) => {
      flightTargetT = null
      ++jumpToken
      isDirectJumpActive = false
      cancelSectionFlight()
      currentChapter =
        progress >= DIGITAL_EXIT_T ? 'hero' : progress >= MONITOR_SNAP_T ? 'digital' : progress >= FILM_FOCUS_T ? 'film' : 'intro'
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
      const targetScroll = scrollForProgress(trigger, targetT)

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
    /**
     * The start of the experience is a HARD MINIMUM, and only forward input
     * may leave it.
     *
     * These listeners used to fire `playIntroCinematic` on any wheel or touch
     * event at all — they never looked at the delta. So scrolling UP at the
     * very beginning started the whole experience, which is backwards: there
     * is nothing behind progress 0 to travel toward.
     *
     * The guard is a DIRECTION-AND-BOUNDARY test, not a "first interaction"
     * one. It lives on the condition rather than on a played-once flag, so it
     * keeps working every time the viewer returns all the way to the start —
     * a reverse play resets `introCinematicPlayed`, and the same rule applies
     * again from then on.
     *
     * Every event is still swallowed with `preventDefault`, including rejected
     * upward ones. That matters: without it a rejected gesture would fall
     * through to native and Lenis scrolling, which would move the page even
     * though the experience refused the input — and Lenis would carry the
     * momentum into a drift once the direction changed. Swallowing it means a
     * backward gesture at the boundary accumulates nothing at all.
     */
    const isForwardWheel = (event) => event.deltaY > 0

    const onIntroTriggerWheel = (event) => {
      if (currentChapter !== 'intro' || introCinematicPlayed) return
      event.preventDefault()
      if (!isForwardWheel(event)) return
      playIntroCinematic(INTRO_ALIGN_T)
    }

    /**
     * Touch has no delta, so direction comes from the gesture itself. Dragging
     * a finger UP pulls the content up — the touch equivalent of scrolling
     * down, and therefore forward. The threshold keeps a stray pixel of
     * movement during a tap from counting as a swipe.
     */
    let introTouchStartY = null
    const INTRO_TOUCH_FORWARD_PX = 6

    const onIntroTouchStart = (event) => {
      introTouchStartY = event.touches[0]?.clientY ?? null
    }

    const onIntroTriggerTouchMove = (event) => {
      if (currentChapter !== 'intro' || introCinematicPlayed) return
      event.preventDefault()
      const currentY = event.touches[0]?.clientY
      if (introTouchStartY === null || currentY === undefined) return
      if (introTouchStartY - currentY <= INTRO_TOUCH_FORWARD_PX) return
      playIntroCinematic(INTRO_ALIGN_T)
    }

    window.addEventListener('wheel', onIntroTriggerWheel, { capture: true, passive: false })
    window.addEventListener('touchstart', onIntroTouchStart, { capture: true, passive: true })
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
    // "Film -> hero" when the intended gesture was "Film -> Digital".
    let chapterGestureAccum = 0
    let chapterGestureDecayTimeoutId = null
    let chapterTouchLastY = null

    const isChapterTransitionLocked = () =>
      isDirectJumpActive || lensHoldActive || monitorLockActive || introCinematicActive

    const resetChapterGesture = () => {
      chapterGestureAccum = 0
      clearTimeout(chapterGestureDecayTimeoutId)
    }

    // Stepping back from Film (nextIndex === -1, since
    // CHAPTER_ORDER.indexOf('film') is 0) must land at the exterior
    // alignment point first — the same pause the FORWARD journey stops
    // at outside the pillars — rather than skipping straight past it into
    // the full reverse orbit, per explicit bug report: the forward
    // journey is Intro -> [scroll] -> pause -> [scroll] -> Film, two
    // distinct legs with a real pause between them, but the reverse only
    // ever reversed the SECOND leg's destination (Film) directly into the
    // FIRST leg's reverse (the full orbit back to t: 0), silently
    // collapsing the pause that exists on the way there. `returnToAlignedPause`
    // (below) is the reverse of that second leg only, landing back in the
    // same chapter-mode-active, currentChapter: 'intro' state the forward
    // pause itself produces — so a FURTHER backward step from there
    // naturally falls into the `nextIndex < -1` case just below and plays
    // the reverse orbit, exactly mirroring the forward two-scroll structure.
    const returnToAlignedPause = () => {
      if (introCinematicActive) return
      const trigger = timeline.scrollTrigger
      if (!trigger) return

      const token = ++jumpToken
      cancelActiveDriversAndLocks()
      isDirectJumpActive = true

      // Same pacing as the forward descent it retraces — see `planJump`.
      runJump(trigger, token, INTRO_ALIGN_T, () => {
        isDirectJumpActive = false
        lastRawProgress = INTRO_ALIGN_T
        scrollProgress.value = INTRO_ALIGN_T
        // Deliberately NOT the 'intro' exit path navigateToSection's own
        // onComplete uses (that resets introCinematicPlayed/chapterModeActive
        // for landing at the literal t: 0 start) — this pause is mid-chapter-mode,
        // identical in every way to the pause the forward orbit itself produces.
        currentChapter = 'intro'
      })
    }

    // nextIndex < -1 means the camera is already paused at the exterior
    // alignment point (having either arrived there via the forward orbit,
    // or via `returnToAlignedPause` above) — a further backward step from
    // there replays the intro cinematic in reverse, Film-aligned-pause all
    // the way back to t: 0, one continuous shot, rather than a discrete
    // jump-cut: `playIntroCinematic` is bidirectional by construction,
    // driven by the exact same `sampleCameraPath`, a pure function of
    // progress.
    const goToChapterIndex = (nextIndex) => {
      if (nextIndex < -1) {
        playIntroCinematic(0)
        return
      }
      if (nextIndex === -1) {
        returnToAlignedPause()
        return
      }
      // The hero is the last chapter: a forward gesture there has nowhere to
      // go, and the camera stays exactly where it is.
      if (nextIndex >= CHAPTER_ORDER.length) return
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

    // Side navigation clicks fly directly; chapter gestures (below the flight
    // code) keep travelling the journey through `navigateToSection`.
    // A section request before the reveal is recorded like a gesture rather
    // than flown: flying would move the camera away from the pose the
    // startup image shows, behind that image, where nobody can see it go.
    const onSectionRequest = (sectionKey) => {
      if (!isExperienceRevealed()) {
        recordStartupIntent({ type: 'section', key: sectionKey })
        return
      }
      flyToSection(sectionKey)
    }
    const unsubscribeNavigate = onNavigateRequest(onSectionRequest)

    // Runs once the startup cover has fully crossfaded into the live scene —
    // not during the crossfade, where a moving camera would show two frames
    // out of register — and does exactly one thing: the latest request.
    const replayHeldIntent = () => {
      const intent = takeStartupIntent()
      if (!intent) return
      if (intent.type === 'section') flyToSection(intent.key)
      else if (currentChapter === 'intro' && !introCinematicPlayed) playIntroCinematic(INTRO_ALIGN_T)
    }
    const unsubscribeRevealed = onExperienceRevealed(replayHeldIntent)

    return () => {
      unsubscribeNavigate()
      unsubscribeRevealed()
      cancelAnimationFrame(raf)
      if (monitorLockTimeoutId) clearTimeout(monitorLockTimeoutId)
      if (lensHoldTimeoutId) clearTimeout(lensHoldTimeoutId)
      if (chapterGestureDecayTimeoutId) clearTimeout(chapterGestureDecayTimeoutId)
      gsap.killTweensOf(scrollProgress)
      HELD_INPUT.forEach((type) => window.removeEventListener(type, holdInputUntilRevealed, { capture: true }))
      window.removeEventListener('wheel', onLensHoldWheel, { capture: true })
      window.removeEventListener('touchmove', onLensHoldWheel, { capture: true })
      window.removeEventListener('wheel', onIntroTriggerWheel, { capture: true })
      window.removeEventListener('touchstart', onIntroTouchStart, { capture: true })
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
