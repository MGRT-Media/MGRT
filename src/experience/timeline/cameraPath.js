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
 * Waypoints — a provisional proof of the camera/scroll mechanism through
 * the approved Phase 1A/1B/1C environment, not the final Film/Digital act
 * choreography (that belongs to Phase 2).
 *
 * These are sampled as a single continuous Catmull-Rom spline (below)
 * rather than independently-eased line segments. Independently easing
 * each segment forces the camera's velocity to zero at *every* waypoint —
 * which is what previously read as a series of small "hard stops" between
 * scroll sections rather than one continuous glide. A spline keeps motion
 * flowing smoothly through the interior waypoints; only the very start
 * (progress 0, at rest) and very end (progress 1, settling at the
 * monitor) actually decelerate to zero, via the one global ease applied
 * to overall progress before sampling the curve.
 *
 * First waypoint matches the approved Phase 1A static hero framing
 * exactly (position [0, 1.6, 9], looking level down -Z) so progress 0
 * never jumps. The path moves forward between the columns, approaches the
 * Phase 1B light beam's floor target while staying outside its dust
 * volume (roughly a 3.4-unit-radius cone), and settles on a shot squarely
 * aligned with the Phase 1D monitor's screen face.
 */
const POSITION_WAYPOINTS = [
  [0, 1.6, 9],
  [0, 1.6, 5],
  [0.5, 1.65, 2],
  [1.0, 1.7, 1],
  MONITOR_ALIGNED_POSITION,
].map((p) => new THREE.Vector3(...p))

// The first lookAt waypoint represents "looking level down -Z" (no literal
// target) — kept at a finite-but-distant Z (not the ~50-unit point used
// pre-spline) so it doesn't act as a wild outlier control point that would
// distort the Catmull-Rom curve's shape near the start of the path.
const LOOKAT_WAYPOINTS = [
  [0, 1.6, -10],
  [0.3, 1.4, -1],
  [0.6, 1.0, -3],
  [0.6, 0.6, -3.5],
  MONITOR_ALIGNED_LOOKAT,
].map((p) => new THREE.Vector3(...p))

const positionCurve = new THREE.CatmullRomCurve3(POSITION_WAYPOINTS, false, 'catmullrom', 0.5)
const lookAtCurve = new THREE.CatmullRomCurve3(LOOKAT_WAYPOINTS, false, 'catmullrom', 0.5)

// Asymmetric single global ease: quintic accel out of rest for the first
// half, then a softer septic (power 7) decel for the second half — a
// longer, gentler tail than a symmetric quintic gives, so the final
// approach into the monitor-locked shot coasts down rather than arriving
// briskly. Continuous in value at t=0.5 (both halves equal 0.5 there).
function easeCameraPath(t) {
  if (t < 0.5) {
    return 16 * t ** 5
  }
  return 1 - (-2 * t + 2) ** 7 / 2
}

/**
 * Pure function of `progress` only (no history/state) — deterministic and
 * therefore trivially reversible: scrolling back to a given progress value
 * always reproduces the exact same camera state.
 */
export function sampleCameraPath(progress) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  const eased = easeCameraPath(p)

  return {
    position: positionCurve.getPoint(eased).toArray(),
    lookAt: lookAtCurve.getPoint(eased).toArray(),
  }
}
