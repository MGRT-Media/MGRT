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
 * Entry-speed dampening for the intro (Entrance -> Establish -> Approach,
 * `t: 0` through `FILM_FOCUS_T`) — per explicit request that a hard flick
 * shouldn't be able to blow through those beats before the Snap 2 pin
 * even engages. Read by `ScrollTimelineProvider.jsx`, which multiplies
 * Lenis's own `wheelMultiplier`/`touchMultiplier` by these values while
 * scroll progress is inside the zone (both live-read per event by Lenis,
 * not cached at construction — confirmed against the installed version,
 * so mutating them at runtime is safe) and restores them to `1` outside
 * it, so the rest of the site's scroll feel is untouched. Skipped
 * entirely under `prefers-reduced-motion` — added friction is the
 * opposite of what that setting asks for.
 */
export const INTRO_DAMPEN_END_T = FILM_FOCUS_T
export const INTRO_WHEEL_MULTIPLIER = 0.35
export const INTRO_TOUCH_MULTIPLIER = 0.35
