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
