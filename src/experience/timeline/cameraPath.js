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
 * Reduced from 5 to 3 waypoints (down from an earlier round's 5-point
 * path) so the trajectory reads as two clear stages rather than several
 * smaller hops: Phase A — [0] to [1], a wide framed view from the
 * entrance past the half-moon pillar arc; Phase B — [1] to [2], one
 * fluid sweep down and in, aligning square with the monitor screen. The
 * removed interior waypoints were the ones most likely to read as
 * "erratic" direction changes on the lookAt curve — fewer points means
 * less opportunity for the spline to double back on itself between them.
 *
 * These are sampled as a single continuous Catmull-Rom spline (below)
 * rather than independently-eased line segments. Independently easing
 * each segment forces the camera's velocity to zero at *every* waypoint —
 * which is what previously read as a series of small "hard stops" between
 * scroll sections rather than one continuous glide. A spline keeps motion
 * flowing smoothly through the interior waypoint; only the very start
 * (progress 0, at rest) and very end (progress 1, settling at the
 * monitor) actually decelerate to zero, via the one global ease applied
 * to overall progress before sampling the curve.
 *
 * First waypoint matches the approved Phase 1A static hero framing
 * exactly (position [0, 1.6, 9], looking level down -Z) so progress 0
 * never jumps. Last waypoint is `MONITOR_ANCHOR`-derived and unchanged
 * across every round of this camera work, so the Phase 1D handshake
 * stays intact.
 */
const POSITION_WAYPOINTS = [[0, 1.6, 9], [0.6, 1.67, 1.5], MONITOR_ALIGNED_POSITION].map(
  (p) => new THREE.Vector3(...p),
)

// The first lookAt waypoint represents "looking level down -Z" (no literal
// target) — kept at a finite-but-distant Z (not the ~50-unit point used
// pre-spline) so it doesn't act as a wild outlier control point that would
// distort the Catmull-Rom curve's shape near the start of the path.
const LOOKAT_WAYPOINTS = [[0, 1.6, -10], [0.5, 1.2, -2], MONITOR_ALIGNED_LOOKAT].map(
  (p) => new THREE.Vector3(...p),
)

const positionCurve = new THREE.CatmullRomCurve3(POSITION_WAYPOINTS, false, 'catmullrom', 0.5)
const lookAtCurve = new THREE.CatmullRomCurve3(LOOKAT_WAYPOINTS, false, 'catmullrom', 0.5)

// Asymmetric single global ease, replacing the previous symmetric
// quintic-in/septic-out curve: that shape had near-zero velocity right at
// progress 0, which made a single ordinary scroll gesture (landing well
// within the slow part of the ramp) produce almost imperceptible camera
// motion — read as the camera "not responding" to the first scroll.
//
// This curve is linear (1:1, full velocity from the very first instant)
// for the first LANDING_START of progress, so the opening move out of the
// hero position is immediately, fully responsive — no ease-in dead zone.
// From LANDING_START to 1 it switches to a cubic Hermite segment tuned so
// its start slope exactly matches the linear portion's slope (no jerk at
// the handoff) and its end slope is exactly 0 — a long, smooth decel to a
// complete stop right at the monitor-locked shot, preserving the soft
// landing. Matching the slope at the junction is what keeps this from
// reintroducing the piecewise "hard stop" problem the spline (see above)
// was built to fix — the two pieces meet at identical velocity, not zero.
//
// A later request asked for `power1.inOut`/smooth-bezier easing here —
// deliberately NOT adopted: `power1.inOut` still has zero velocity at
// t=0, exactly the dead-zone shape that was diagnosed and fixed by this
// linear-start curve. Kept the responsive start and addressed that
// request's smoothness goal a different way instead — fewer waypoints
// (see POSITION_WAYPOINTS/LOOKAT_WAYPOINTS above) and this same ease
// shape, which was already smooth/jerk-free at the landing handoff.
const LANDING_START = 0.85
const LANDING_SPAN = 1 - LANDING_START

function easeCameraPath(t) {
  if (t <= LANDING_START) {
    return t
  }
  // Cubic Hermite on u = local progress through the landing segment
  // (o(0) = 0, o(1) = 1, o'(0) = 1, o'(1) = 0). The o'(0) = 1 condition is
  // what matches the linear portion's slope through the chain rule —
  // d(eased)/dt = o'(u) here, since the u-substitution's two scale factors
  // (LANDING_SPAN in the numerator from re-expanding by LANDING_SPAN,
  // 1/LANDING_SPAN from du/dt) cancel exactly.
  const u = (t - LANDING_START) / LANDING_SPAN
  const o = -(u ** 3) + u ** 2 + u
  return LANDING_START + LANDING_SPAN * o
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
