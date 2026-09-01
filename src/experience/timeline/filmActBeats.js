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
 * Intro (Entrance -> Establish -> Approach, `t: 0` through `FILM_FOCUS_T`)
 * hard rate cap. Superseded a proportional `wheelMultiplier` damper
 * (0.35x) that turned out not to be strict enough — per direct follow-up
 * report, a hard or repeated flick could still cover the whole zone in a
 * handful of events, since a *multiplier* still scales with arbitrarily
 * large input. This is a genuine ceiling instead: read by
 * `ScrollTimelineProvider.jsx`, which fully intercepts scroll input for
 * the zone and drives `scrollProgress.value` itself at a fixed maximum
 * rate, so no amount of scrolling — hard, soft, repeated, or held down —
 * can move faster than this. `INTRO_ZONE_END_T / INTRO_MAX_RATE_PER_SECOND`
 * is therefore a guaranteed minimum traversal time, not just a
 * statistical slowdown. Still 100% input-driven, not auto-play: the
 * driver only advances while the visitor is actively scrolling (a short
 * decay window, `INTRO_INTENT_DECAY_MS`, treats a pause as "stopped");
 * releasing the wheel/trackpad stops it immediately, same as everywhere
 * else in the experience, per experience-design.md §3's "Scroll controls
 * time" / no-auto-scroll rule.
 */
export const INTRO_ZONE_END_T = FILM_FOCUS_T
// Raised from 2.5s per explicit follow-up ("slow down even further") —
// still a hard ceiling, not a statistical average; see the module doc
// comment above.
export const INTRO_MIN_TRAVERSAL_SECONDS = 4.5
export const INTRO_MAX_RATE_PER_SECOND = INTRO_ZONE_END_T / INTRO_MIN_TRAVERSAL_SECONDS
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
