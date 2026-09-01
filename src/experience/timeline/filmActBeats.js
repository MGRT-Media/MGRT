/**
 * Shared timeline constants for the two Phase 2 scroll-snap points —
 * Snap #1 (Cinema Lens, mid-timeline) and Snap #2 (Digital Monitor, end
 * of timeline). Lives in its own small module (not inside `cameraPath.js`,
 * `CinemaCamera.jsx`, or `ScrollTimelineProvider.jsx`) so all three can
 * import from it without creating a circular dependency: `cameraPath.js`
 * already imports `CAMERA_ANCHOR` from `CinemaCamera.jsx`, so
 * `CinemaCamera.jsx` can't also import back from `cameraPath.js`.
 */
export const FILM_FOCUS_T = 0.45

// How much scroll progress on either side of FILM_FOCUS_T the lens
// screen's ignite ramps in/out over — a smooth "hill" centered on the
// hero beat rather than a hard on/off toggle.
export const FILM_IGNITE_RISE = 0.12

// How close the user must stop scrolling (in normalized 0-1 progress) to
// FILM_FOCUS_T for it to "click" into that exact resting point — the
// Cinema Lens snap. Read by `ScrollTimelineProvider.jsx`'s scroll-snap
// function.
export const FILM_SNAP_CAPTURE_RADIUS = 0.06

// The Digital Monitor snap point — the end of the normalized scroll
// timeline. A capture radius here still means something even though 1.0
// is also the natural scroll limit: without it, native scroll
// deceleration can leave the resting progress a little short of exactly
// 1.0 (e.g. 0.97), landing a slightly-off frame instead of the intended
// aligned shot. Read by `ScrollTimelineProvider.jsx`'s scroll-snap
// function.
export const MONITOR_SNAP_T = 1
export const MONITOR_SNAP_CAPTURE_RADIUS = 0.08
