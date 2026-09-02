/**
 * Shared timeline constants for the three Phase 2 scroll-snap positions,
 * per explicit request for "3 distinct, locked snap/pause positions":
 * Snap 1 (Studio Scene establish), Snap 2 (Cinema Lens), Snap 3 (Digital
 * Monitor). Lives in its own small module (not inside `cameraPath.js`,
 * `CinemaCamera.jsx`, or `ScrollTimelineProvider.jsx`) so all three can
 * import from it without creating a circular dependency: `cameraPath.js`
 * already imports `CAMERA_ANCHOR` from `CinemaCamera.jsx`, so
 * `CinemaCamera.jsx` can't also import back from `cameraPath.js`.
 */

// Snap 1 — Studio Scene (Establish): the entrance glide's resting point,
// framing the Cinema Camera and Monitor stands side by side before the
// camera moves on toward either one individually.
export const ESTABLISH_T = 0.15
export const ESTABLISH_SNAP_CAPTURE_RADIUS = 0.05

// Snap 2 — Cinema Lens (Focus).
export const FILM_FOCUS_T = 0.45
export const FILM_SNAP_CAPTURE_RADIUS = 0.06

// How much scroll progress on either side of FILM_FOCUS_T the lens
// screen's ignite ramps in/out over — a smooth "hill" centered on the
// hero beat rather than a hard on/off toggle.
export const FILM_IGNITE_RISE = 0.12

// Snap 3 — Digital Monitor (Interface): the end of the normalized scroll
// timeline. A capture radius here still means something even though 1.0
// is also the natural scroll limit: without it, native scroll
// deceleration can leave the resting progress a little short of exactly
// 1.0 (e.g. 0.97), landing a slightly-off frame instead of the intended
// aligned shot.
export const MONITOR_SNAP_T = 1
export const MONITOR_SNAP_CAPTURE_RADIUS = 0.08

/**
 * Force-Stop / Timed Release — Snap 2 and Snap 3 only, per explicit
 * request (Snap 1's establish shot stays a soft magnetic snap; nothing
 * else in the experience is worth the visitor feeling stopped for).
 * Read by `ScrollTimelineProvider.jsx` (the lock/release logic) and
 * `ScrollLockIndicator.jsx` (times its visual cue to the same duration).
 */
// How long the camera trajectory is force-stopped once it clicks onto
// Snap 2/3 — within the requested 1.5-2s range.
export const SCROLL_LOCK_HOLD_MS = 1750

// How far (in normalized 0-1 progress) the LIVE scroll position must
// drift from the pinned snap point while locked before it counts as a
// deliberate override attempt and breaks the lock early, per explicit
// request that "aggressive scrolling... gently breaks the lock." Scroll
// keeps being tracked underneath the pin the whole time (see
// ScrollTimelineProvider.jsx) — only the visible camera/video freezes —
// so a determined scroll accumulates this drift and releases early,
// while idle or gentle scrolling holds for the full duration.
export const SCROLL_LOCK_OVERRIDE_DRIFT = 0.05

/**
 * Intro cinematic (Entrance -> exterior half-circle, `t: 0` through
 * `INTRO_ALIGN_T`) — superseded the previous continuous, input-driven
 * hard-rate-cap mechanism entirely, per explicit request: "the initial
 * camera movement should no longer be continuous scroll-driven... ONE
 * SCROLL -> ONE COMPLETE CAMERA MOVE... do not map the camera's exact
 * position directly to scroll progress... the scroll should act as a
 * trigger, not as a continuous steering mechanism." One scroll/touch
 * gesture now triggers a single, fixed-duration auto-play tween from
 * `t: 0` to `INTRO_ALIGN_T` (`ScrollTimelineProvider.jsx`'s
 * `playIntroCinematic`); further input during that tween is ignored
 * entirely, and once it completes, control hands off to the existing
 * chapter-mode gesture system (`CHAPTER_GESTURE_THRESHOLD` below) rather
 * than resuming any form of continuous scroll.
 *
 * `INTRO_ALIGN_T` matches `cameraPath.js`'s own `ORBIT_BODY_T_END` — the
 * exact progress value where the exterior orbit's last keyframe sits,
 * already exactly aligned with the Film lens (see that file's own
 * derivation). Shared here, not duplicated, so the two files can't drift
 * out of sync with each other.
 */
export const INTRO_ALIGN_T = 0.12
// Slow, smooth, deliberate — "one continuous opening shot in a premium
// commercial." Scaled by how far a given one-shot move actually travels
// (`ScrollTimelineProvider.jsx`'s `playIntroCinematic`): the forward
// entrance (distance `INTRO_ALIGN_T`) lands at exactly the minimum: a
// reverse move all the way back from Film (distance `FILM_FOCUS_T`, ~3.75x
// farther) scales up but is capped at the maximum rather than dragging on
// for proportionally as long. Raised again (6 -> 9, 12 -> 16) per explicit
// follow-up to slow the spiral down further — the room's own orbit radius
// has also grown considerably (§4BE, 6.9 -> 9.0), so the camera now covers
// more real distance than when 6s was originally tuned.
export const INTRO_CINEMATIC_MIN_DURATION_SECONDS = 9
export const INTRO_CINEMATIC_MAX_DURATION_SECONDS = 16

// The one specific hop from the exterior alignment point (`INTRO_ALIGN_T`)
// to Film, whether triggered by the "second scroll" gesture or a direct
// nav-click while already there — a fixed duration, not the general
// `JUMP_MIN/MAX_DURATION_SECONDS` distance-scaled range below, per
// explicit follow-up to slow this specific leg down without also slowing
// the unrelated Film<->Digital chapter hop that range also governs. Set
// well above what that formula would otherwise produce for this distance
// (`FILM_FOCUS_T - INTRO_ALIGN_T` ≈ 0.33, which the general formula would
// clamp to ~1.1s) so "straight to the lens" reads as deliberate, not brisk.
export const INTRO_TO_FILM_DURATION_SECONDS = 4.5

export const INTRO_INTENT_DECAY_MS = 150

/**
 * Snap 2/3 lock-entry "catch" — per explicit request to eliminate the
 * mechanical/jarring feel of the previous instant `scrollProgress.value =
 * <target>` jump on engaging a lock. `ScrollTimelineProvider.jsx` now
 * tweens into the pinned value over this duration with this ease, instead
 * of snapping to it in one frame — the hold timer itself only starts once
 * this catch tween completes, so the total "arrive, then hold" sequence
 * reads as one continuous deceleration rather than a snap followed by a
 * pause. Duration and ease both increased per a later explicit follow-up
 * ("apply heavy exponential deceleration... give the camera weight") —
 * `power4.out` decelerates harder than `power3.out` right at the very
 * end of the tween, reading as a heavier "settle" rather than a brisk
 * ease-out.
 */
export const LOCK_CATCH_DURATION_SECONDS = 0.75
export const LOCK_CATCH_EASE = 'power4.out'

/**
 * Direct-navigation destinations for the side navigation
 * (`SectionIndicator.jsx` / `sectionNavigationEvent.js`) — reuses the exact
 * same landmark constants already driving the scroll-snap/lock logic above
 * rather than inventing separate coordinates, per explicit request to
 * integrate into the existing state engine instead of building a parallel
 * one. Keyed to match the indicator's own section keys.
 *
 * `campaigns` and `return` are deliberately absent: neither has a real
 * camera landmark yet (the Campaigns billboard reveal and the Return
 * dive-back-in are both "NOT STARTED" per build-status.md's Phase Progress
 * tracker) — there is no correct coordinate to jump to, so those marks stay
 * visually present (hoverable, per the UI spec) but functionally inert
 * rather than fabricating a placeholder position.
 */
export const SECTION_TARGETS = {
  intro: 0,
  film: FILM_FOCUS_T,
  digital: MONITOR_SNAP_T,
}

// Direct-navigation jump duration range, in seconds — scaled by travel
// distance between these bounds so a short Film<->Digital jump doesn't
// linger and a full Intro<->Digital traverse doesn't feel rushed. Also
// reused, unchanged, as the chapter-mode transition duration (below) —
// same underlying jump mechanism, so one range covers both. Max lowered
// from 2.2 to 1.6 (was tuned before chapter mode existed) per explicit
// request for "approximately 0.8-1.5s" on a chapter hop: the Film<->Digital
// distance (0.55 of the full 0-1 range) now lands at ~1.3s, while the full
// Intro<->Digital traverse (distance 1.0, direct-nav only) still gets the
// longest end of the range at 1.6s.
export const JUMP_MIN_DURATION_SECONDS = 0.9
export const JUMP_MAX_DURATION_SECONDS = 1.6

/**
 * Chapter mode (Film and beyond) — per explicit request, once the camera
 * reaches Film the mouse wheel/trackpad/touch stops driving continuous
 * scroll progress and instead becomes a discrete "advance one chapter"
 * gesture input. `CHAPTER_GESTURE_THRESHOLD` is the accumulated wheel
 * `deltaY` (summed across events, decaying back to 0 after
 * `INTRO_INTENT_DECAY_MS` of no input — the same decay window the intro
 * driver already uses, reused rather than adding a near-duplicate
 * constant) needed to register as one deliberate gesture. A single
 * ordinary mouse-wheel notch (~100) or one light trackpad swipe clears
 * this comfortably; the real defense against "fast scroll skips two
 * chapters" is `ScrollTimelineProvider.jsx`'s own transition lock
 * (reusing `isDirectJumpActive`, already set for a jump's full duration),
 * which makes every event during an in-flight transition a no-op rather
 * than something this threshold has to filter out on its own.
 */
export const CHAPTER_GESTURE_THRESHOLD = 50
