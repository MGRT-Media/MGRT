import * as THREE from 'three'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'

// The Phase 1D "squarely aligned with the screen" shot: centered on the
// screen's X/Y, offset along +Z by a distance chosen to frame the screen
// with comfortable margin (not edge-to-edge) at this camera's fov=45.
const MONITOR_VIEW_DISTANCE = 2.1
const MONITOR_ALIGNED_POSITION = [
  MONITOR_ANCHOR.position[0],
  MONITOR_ANCHOR.screenCenterHeight,
  MONITOR_ANCHOR.position[2] + MONITOR_VIEW_DISTANCE,
]
const MONITOR_ALIGNED_LOOKAT = [
  MONITOR_ANCHOR.position[0],
  MONITOR_ANCHOR.screenCenterHeight,
  MONITOR_ANCHOR.position[2],
]

/**
 * Full rewrite, per explicit request, of the multi-waypoint spline +
 * banking path from the previous several rounds: a single straight line,
 * no curvature, no roll.
 *
 * This supersedes the approved Phase 1A hero framing's starting position
 * AND orientation — `[0, 1.6, 9]` looking level down -Z — which every
 * prior round of camera work explicitly preserved byte-for-byte
 * ("progress 0 never jumps"). This request is the first to ask for that
 * to change, explicitly and in detail (an exact starting position beside
 * the left entrance pillar, locked onto the monitor from the first
 * frame), so it's implemented as a deliberate supersession, flagged here
 * and in build-status.md §5, not a silent drift from the approved shot.
 *
 * START_POSITION sits between the two entrance pillars (`Environment.jsx`'s
 * `entrancePillarPositions`, `[∓2.2, 4]`), pulled significantly further
 * back along Z (deeper into "behind" the pillar threshold) than the two
 * previous rounds' `[-1.2, 1.6, 4.5]` and `[-3.6, 1.6, 3.2]`, so both
 * entrance pillars read as a clear architectural gateway flanking the
 * frame and the half-moon arc is visible as a wide establishing view
 * deep in the background, per explicit request. The end position is
 * still `MONITOR_ANCHOR`-derived and unchanged, so the Phase 1D
 * handshake stays intact.
 */
const START_POSITION = new THREE.Vector3(-1.0, 1.6, 8)
const END_POSITION = new THREE.Vector3(...MONITOR_ALIGNED_POSITION)

// Locked onto the monitor screen face for the entire scroll, per explicit
// request — not interpolated from a separate starting look direction, so
// there's no orientation sweep to eliminate in the first place.
const LOOK_AT = MONITOR_ALIGNED_LOOKAT

/**
 * Pure function of `progress` only (no history/state) — deterministic and
 * therefore trivially reversible: scrolling back to a given progress value
 * always reproduces the exact same camera state.
 *
 * Position is a direct linear interpolation (`Vector3.lerpVectors`) with
 * no easing curve layered on top — progress maps to position at a
 * perfectly constant rate on every axis, including Y, so the altitude
 * decreases evenly across the whole scroll with no deceleration, plateau,
 * or steepening anywhere to read as a "drop" or a "leveling off." The
 * existing frame-rate-independent damp smoothing in `ScrollCameraRig.jsx`
 * (unchanged) still turns discrete scroll input into a physically
 * continuous glide in real time — removing the *spatial* curve doesn't
 * remove that separate, still-necessary *temporal* smoothing layer.
 *
 * `roll` is always 0 — no banking, no rotation shifts, per explicit
 * request. `ScrollCameraRig.jsx`'s roll-handling code from the previous
 * round is removed entirely rather than just parameterized to zero, since
 * banking isn't a feature this design calls for at all right now.
 */
export function sampleCameraPath(progress) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  const position = new THREE.Vector3().lerpVectors(START_POSITION, END_POSITION, p)

  return {
    position: position.toArray(),
    lookAt: LOOK_AT,
  }
}
