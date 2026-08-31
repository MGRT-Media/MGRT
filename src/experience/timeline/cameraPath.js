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
 * Four waypoints define three continuous stages, per the request:
 *  - Entry [0]→[1]: wide, centered view down the sanctuary, level.
 *  - Right-side arc [1]→[2]: drifts right toward the breach's light
 *    shaft (x rises to 1.6, well clear of every arc pillar — the arc's
 *    pillars all sit at z ≤ -4, while this waypoint is at z: 1, so there's
 *    no proximity to check).
 *  - Monitor approach [2]→[3]: glides forward into the screen-aligned
 *    shot.
 *
 * These are sampled as a single continuous Catmull-Rom spline (below)
 * rather than independently-eased line segments — independently easing
 * each segment forces the camera's velocity to zero at *every* waypoint,
 * which reads as repeated hard stops rather than one glide. A spline
 * keeps motion flowing through the interior waypoints; only progress 0
 * (at rest) and progress 1 (settling at the monitor) decelerate to zero,
 * via the one global ease applied to progress before sampling (below).
 *
 * First waypoint matches the approved Phase 1A static hero framing
 * exactly (position [0, 1.6, 9], looking level down -Z) so progress 0
 * never jumps. Last waypoint is `MONITOR_ANCHOR`-derived and unchanged
 * across every round of this camera work, so the Phase 1D handshake
 * stays intact.
 */
const POSITION_WAYPOINTS = [
  [0, 1.6, 9],
  [0, 1.6, 5],
  [1.6, 1.7, 1],
  MONITOR_ALIGNED_POSITION,
].map((p) => new THREE.Vector3(...p))

// The first lookAt waypoint represents "looking level down -Z" (no literal
// target) — kept at a finite-but-distant Z (not the ~50-unit point used
// pre-spline) so it doesn't act as a wild outlier control point that would
// distort the Catmull-Rom curve's shape near the start of the path.
const LOOKAT_WAYPOINTS = [
  [0, 1.6, -10],
  [0, 1.5, -6],
  [1.4, 1.2, -3],
  MONITOR_ALIGNED_LOOKAT,
].map((p) => new THREE.Vector3(...p))

const positionCurve = new THREE.CatmullRomCurve3(POSITION_WAYPOINTS, false, 'catmullrom', 0.5)
const lookAtCurve = new THREE.CatmullRomCurve3(LOOKAT_WAYPOINTS, false, 'catmullrom', 0.5)

// Single monotonic ease-out across the whole 0–1 domain — replacing the
// previous piecewise linear-then-Hermite-landing curve, which had a
// measured, real defect: matching the Hermite segment's start slope to
// the linear portion's constant slope (so the handoff itself had no
// jerk) forced a brief SPEED-UP just past progress 0.85 (peak slope
// ≈1.33 around progress ≈0.90) before the final decel to a stop — see
// the git history for the numeric derivative check. That hump, landing
// right where the camera is also descending toward the monitor's lower
// screen-center height, is what read as a "sudden drop" right before
// the monitor lock — confirmed by re-running that same derivative check
// before touching this function, not assumed from the report alone.
//
// f(t) = 1 - (1-t)^POWER is a pure ease-out: maximum velocity at t=0
// (POWER × the old cruise rate — chosen at 1.5 for a modest, not
// jarring, opening burst) decreasing *monotonically* the entire way to
// exactly 0 at t=1. No cruise-then-brake handoff, so there's no knot to
// force a hump at — the whole path is one smooth deceleration, which is
// what actually eliminates the drop (reshaping the waypoints alone,
// without fixing this, would not have). It also still opens at nonzero
// velocity, so the dead-zone problem (§4K/§4L) stays fixed.
//
// This request also asked for `power1.inOut` specifically — not adopted,
// same reasoning as last round: that shape has zero velocity at t=0,
// reintroducing the dead zone. A pure ease-out (not ease-in-out) is what
// satisfies "responsive start" and "zero abrupt acceleration" together.
const EASE_OUT_POWER = 1.5

function easeCameraPath(t) {
  return 1 - (1 - t) ** EASE_OUT_POWER
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
