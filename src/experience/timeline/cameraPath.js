import * as THREE from 'three'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'
import { CAMERA_ANCHOR } from '../film/CinemaCamera.jsx'
import { FILM_FOCUS_T } from './filmActBeats.js'

/**
 * Multi-keyframe path, replacing the single straight opening→monitor line
 * from Phase 1D/2's earlier round. That simplification assumed one single
 * destination (the monitor); it no longer holds now that the Cinema
 * Camera and Monitor share one plinth and the scroll needs to visit both
 * in turn — Act 1's tight hero shot on the Cinema Camera, then a pan/
 * track across the plinth into Act 2's monitor-centered shot, per
 * explicit request. Flagged here as a deliberate supersession of the
 * prior "no waypoints" simplification, not a silent drift back to it.
 *
 * Still a pure function of `progress` (deterministic, reversible) and
 * still no roll/banking — only the number of waypoints changed, not the
 * underlying interpolation philosophy (constant-rate `lerpVectors` per
 * segment, no eased curve layered into the spatial path itself; temporal
 * smoothing is still `ScrollCameraRig.jsx`'s separate damp layer).
 */
const START_POSITION = new THREE.Vector3(-1.0, 1.6, 8)

// Opening wide shot looks toward the shared plinth ensemble generally
// (not yet singling out either object) — a reasonable establishing
// look-at height between the two objects' own centers.
const OPENING_LOOKAT = new THREE.Vector3(MONITOR_ANCHOR.position[0], 1.3, MONITOR_ANCHOR.position[2])

// Act 1 hero beat: tight, dramatic framing on the Cinema Camera's lens —
// closer than the monitor's own approach distance, and angled slightly
// above lens height for a more dramatic (less head-on) composition.
const FILM_HERO_DISTANCE = 1.1
const [lensX, lensY, lensZ] = CAMERA_ANCHOR.lensFrontFieldPosition
const [fwdX, , fwdZ] = CAMERA_ANCHOR.lensForward
const FILM_HERO_POSITION = new THREE.Vector3(
  lensX + fwdX * FILM_HERO_DISTANCE,
  CAMERA_ANCHOR.bodyCenterHeight + 0.12,
  lensZ + fwdZ * FILM_HERO_DISTANCE,
)
const FILM_HERO_LOOKAT = new THREE.Vector3(lensX, lensY, lensZ)

// Act 2 arrival: the existing "squarely aligned with the screen" shot,
// now derived from the Monitor's real world screen position/forward
// (accounts for its offset onto the shared plinth) rather than the bare
// plinth-center approximation used before that offset existed.
const MONITOR_VIEW_DISTANCE = 2.1
const [screenX, screenY, screenZ] = MONITOR_ANCHOR.screenWorldPosition
const [screenFwdX, , screenFwdZ] = MONITOR_ANCHOR.screenForward
const MONITOR_ALIGNED_POSITION = new THREE.Vector3(
  screenX + screenFwdX * MONITOR_VIEW_DISTANCE,
  screenY,
  screenZ + screenFwdZ * MONITOR_VIEW_DISTANCE,
)
const MONITOR_ALIGNED_LOOKAT = new THREE.Vector3(screenX, screenY, screenZ)

const KEYFRAMES = [
  { t: 0, position: START_POSITION, lookAt: OPENING_LOOKAT },
  { t: FILM_FOCUS_T, position: FILM_HERO_POSITION, lookAt: FILM_HERO_LOOKAT },
  { t: 1, position: MONITOR_ALIGNED_POSITION, lookAt: MONITOR_ALIGNED_LOOKAT },
]

/**
 * Pure function of `progress` only (no history/state) — deterministic and
 * therefore trivially reversible. Finds the two keyframes progress falls
 * between and linearly interpolates position/lookAt independently within
 * that segment only — each segment reads at its own constant rate, with
 * no easing curve, matching the project's established spatial-path
 * convention.
 */
export function sampleCameraPath(progress) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)

  let i = 0
  while (i < KEYFRAMES.length - 2 && p > KEYFRAMES[i + 1].t) i += 1
  const a = KEYFRAMES[i]
  const b = KEYFRAMES[i + 1]
  const segmentT = b.t === a.t ? 0 : (p - a.t) / (b.t - a.t)

  const position = new THREE.Vector3().lerpVectors(a.position, b.position, segmentT)
  const lookAt = new THREE.Vector3().lerpVectors(a.lookAt, b.lookAt, segmentT)

  return {
    position: position.toArray(),
    lookAt: lookAt.toArray(),
  }
}
