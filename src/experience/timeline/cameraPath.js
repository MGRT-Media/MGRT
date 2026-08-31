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

function lerpVec3(a, b, t) {
  return [
    THREE.MathUtils.lerp(a[0], b[0], t),
    THREE.MathUtils.lerp(a[1], b[1], t),
    THREE.MathUtils.lerp(a[2], b[2], t),
  ]
}

const APPROACH_POSITION = [1.0, 1.7, 1]
const APPROACH_LOOKAT = [0.6, 0.6, -3.5]

// A "settle" keyframe inserted just before the final monitor-aligned shot:
// most (85%) of the remaining distance is covered by t: 0.75 -> 0.92, so
// the last stretch (0.92 -> 1.0) is a deliberately small movement. Combined
// with the per-segment ease below, this reads as the camera decelerating
// and settling into frame rather than sweeping all the way in and stopping
// abruptly at progress 1.0. Derived from APPROACH_*/MONITOR_ALIGNED_* (not
// hand-picked numbers) so it stays correct if either endpoint ever moves.
const SETTLE_T = 0.92
const SETTLE_BLEND = 0.85
const SETTLE_POSITION = lerpVec3(APPROACH_POSITION, MONITOR_ALIGNED_POSITION, SETTLE_BLEND)
const SETTLE_LOOKAT = lerpVec3(APPROACH_LOOKAT, MONITOR_ALIGNED_LOOKAT, SETTLE_BLEND)

/**
 * Camera keyframes — a provisional proof of the camera/scroll mechanism
 * through the approved Phase 1A/1B/1C environment, not the final Film/
 * Digital act choreography (that belongs to Phase 2).
 *
 * Keyframe 0 matches the approved Phase 1A static hero framing exactly
 * (position [0, 1.6, 9], looking level down -Z) so progress 0 never jumps.
 * The path then moves forward between the columns, approaches the Phase
 * 1B light beam's floor target while staying outside its dust volume
 * (roughly a 3.4-unit-radius cone), and finally glides — with an explicit
 * settle keyframe for a gentler deceleration — to a shot squarely aligned
 * with the Phase 1D monitor's screen face.
 */
const KEYFRAMES = [
  { t: 0.0, position: [0, 1.6, 9], lookAt: [0, 1.6, -50] },
  { t: 0.25, position: [0, 1.6, 5], lookAt: [0.3, 1.4, -1] },
  { t: 0.5, position: [0.5, 1.65, 2], lookAt: [0.6, 1.0, -3] },
  { t: 0.75, position: APPROACH_POSITION, lookAt: APPROACH_LOOKAT },
  { t: SETTLE_T, position: SETTLE_POSITION, lookAt: SETTLE_LOOKAT },
  { t: 1.0, position: MONITOR_ALIGNED_POSITION, lookAt: MONITOR_ALIGNED_LOOKAT },
]

// Quintic in/out — a more pronounced "gentle accel out of rest, soft glide
// to a stop" curve than a cubic ease, per this pass's request to eliminate
// any remaining mechanical/linear feel between keyframes.
function easeInOutQuint(t) {
  return t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2
}

/**
 * Pure function of `progress` only (no history/state) — deterministic and
 * therefore trivially reversible: scrolling back to a given progress value
 * always reproduces the exact same camera state.
 */
export function sampleCameraPath(progress) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)

  let start = KEYFRAMES[0]
  let end = KEYFRAMES[KEYFRAMES.length - 1]
  for (let i = 0; i < KEYFRAMES.length - 1; i += 1) {
    if (p >= KEYFRAMES[i].t && p <= KEYFRAMES[i + 1].t) {
      start = KEYFRAMES[i]
      end = KEYFRAMES[i + 1]
      break
    }
  }

  const span = end.t - start.t || 1
  const localT = easeInOutQuint(THREE.MathUtils.clamp((p - start.t) / span, 0, 1))

  return {
    position: lerpVec3(start.position, end.position, localT),
    lookAt: lerpVec3(start.lookAt, end.lookAt, localT),
  }
}
