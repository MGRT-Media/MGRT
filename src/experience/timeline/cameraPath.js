import * as THREE from 'three'

/**
 * Phase 1C camera keyframes — a provisional proof of the camera/scroll
 * mechanism through the approved Phase 1A/1B environment, not the final
 * Film act choreography (that belongs to Phase 1D/Phase 2).
 *
 * Keyframe 0 matches the approved Phase 1A static hero framing exactly
 * (position [0, 1.6, 9], looking level down -Z) so progress 0 never jumps.
 * The path then moves forward between the columns and settles facing the
 * Phase 1B light beam's floor target — the "central physical anchor" for
 * this phase, since the Film camera object itself is out of scope until
 * Phase 1D. The final keyframe deliberately stays outside the beam's dust
 * volume (roughly a 3.4-unit-radius cone around the floor target) rather
 * than moving into it — an approach shot, not a fly-through.
 */
const KEYFRAMES = [
  { t: 0.0, position: [0, 1.6, 9], lookAt: [0, 1.6, -50] },
  { t: 0.35, position: [0, 1.6, 5], lookAt: [0.3, 1.4, -1] },
  { t: 0.7, position: [0.5, 1.65, 2], lookAt: [0.6, 1.0, -3] },
  { t: 1.0, position: [1.0, 1.7, 1], lookAt: [0.6, 0.6, -3.5] },
]

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function lerpVec3(a, b, t) {
  return [
    THREE.MathUtils.lerp(a[0], b[0], t),
    THREE.MathUtils.lerp(a[1], b[1], t),
    THREE.MathUtils.lerp(a[2], b[2], t),
  ]
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
  const localT = easeInOutCubic(THREE.MathUtils.clamp((p - start.t) / span, 0, 1))

  return {
    position: lerpVec3(start.position, end.position, localT),
    lookAt: lerpVec3(start.lookAt, end.lookAt, localT),
  }
}
