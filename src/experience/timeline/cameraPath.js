import * as THREE from 'three'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'
import { CAMERA_ANCHOR } from '../film/CinemaCamera.jsx'
import { FILM_FOCUS_T } from './filmActBeats.js'

/**
 * Multi-keyframe path, replacing the single straight opening→monitor line
 * from Phase 1D/2's earlier round. That simplification assumed one single
 * destination (the monitor); it no longer holds now that the scroll needs
 * to visit both the Cinema Camera and Monitor in turn — Act 1 dives
 * straight into the Cinema Camera's lens until the film media fills the
 * frame, then Act 2 pulls back out of the lens and pans across to the
 * Monitor-centered shot, per explicit request. Flagged here as a
 * deliberate supersession of the prior "no waypoints" simplification, not
 * a silent drift back to it.
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

// Act 1 lens-dive beat: the scroll sequence flies straight into the
// Cinema Camera's optical glass, per explicit request — not a respectful
// "hero shot" distance but close enough that the film media dominates
// the frame, with the barrel's curved lip (CinemaCamera.jsx's
// lensLipGeometry) reading as a tight frame around the viewport's border
// rather than the video running edge-to-edge with no visible lens at all
// (creative-reference.md §6's "Lens transition... approach the lens
// closely enough that it becomes a dark circular visual field").
// Distance is derived from the lens's own radius and this camera's fov
// (45°) so the lens disc subtends ~82% of the vertical half-frame at
// this keyframe, leaving the outer ~18% for the lip/barrel to frame it —
// close/immersive without crossing into near-plane clipping territory
// (near: 0.05, so this keeps a >3x safety margin).
const LENS_DIVE_FILL_FRACTION = 0.82
const LENS_DIVE_HALF_FOV_RADIANS = THREE.MathUtils.degToRad(45 / 2) * LENS_DIVE_FILL_FRACTION
const LENS_DIVE_DISTANCE = CAMERA_ANCHOR.lensRadius / Math.tan(LENS_DIVE_HALF_FOV_RADIANS)
const [lensX, lensY, lensZ] = CAMERA_ANCHOR.lensFrontFieldPosition
const [fwdX, , fwdZ] = CAMERA_ANCHOR.lensForward
const LENS_DIVE_POSITION = new THREE.Vector3(
  lensX + fwdX * LENS_DIVE_DISTANCE,
  lensY,
  lensZ + fwdZ * LENS_DIVE_DISTANCE,
)
const LENS_DIVE_LOOKAT = new THREE.Vector3(lensX, lensY, lensZ)

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
  { t: FILM_FOCUS_T, position: LENS_DIVE_POSITION, lookAt: LENS_DIVE_LOOKAT },
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
