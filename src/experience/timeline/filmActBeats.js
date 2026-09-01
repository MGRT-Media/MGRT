/**
 * Shared timeline constant for the Act 1 (Film) hero beat — the scroll
 * progress where the camera holds its tight, dramatic shot on the Cinema
 * Camera before panning on to the Monitor for Act 2. Lives in its own
 * small module (not inside `cameraPath.js` or `CinemaCamera.jsx`) so both
 * can import it without creating a circular dependency: `cameraPath.js`
 * already imports `CAMERA_ANCHOR` from `CinemaCamera.jsx`, so
 * `CinemaCamera.jsx` can't also import back from `cameraPath.js`.
 */
export const FILM_FOCUS_T = 0.45

// How much scroll progress on either side of FILM_FOCUS_T the lens
// screen's ignite ramps in/out over — a smooth "hill" centered on the
// hero beat rather than a hard on/off toggle.
export const FILM_IGNITE_RISE = 0.12
