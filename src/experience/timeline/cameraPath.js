import * as THREE from 'three'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'
import { CAMERA_ANCHOR } from '../film/CinemaCamera.jsx'
import { BEAM_CENTER } from '../digital/plinthAnchor.js'
import { ESTABLISH_T, FILM_FOCUS_T } from './filmActBeats.js'

/**
 * Multi-keyframe path, replacing the single straight opening→monitor line
 * from Phase 1D/2's earlier round. That simplification assumed one single
 * destination (the monitor); it no longer holds now that the scroll needs
 * to visit all three locked positions in turn, per explicit request for
 * "3 distinct, locked snap/pause positions": **Snap 1 — Studio Scene**
 * (the entrance glide settles on an establish shot framing the Cinema
 * Camera and Monitor stands side by side), **Snap 2 — Cinema Lens**
 * (the camera moves in and dives into the lens until the film media
 * fills the frame), **Snap 3 — Digital Monitor** (pulls back out of the
 * lens, sweeps across, and locks onto the Monitor screen edge-to-edge).
 * All three snap points are backed by `ScrollTimelineProvider.jsx`'s
 * scroll-snap (`filmActBeats.js`'s `ESTABLISH_T`/`FILM_FOCUS_T`/
 * `MONITOR_SNAP_T`), so the keyframes here define WHERE the camera locks;
 * the snap defines WHEN scroll position clicks onto them. Flagged here as
 * a deliberate supersession of the prior "no waypoints" simplification,
 * not a silent drift back to it.
 *
 * Still a pure function of `progress` (deterministic, reversible) and
 * still no roll/banking. Each segment now applies a `smoothstep` ease to
 * its own local progress before interpolating — a deliberate supersession
 * of this file's prior "no eased curve layered into the spatial path"
 * note, per explicit request for bezier-smooth easing that eliminates
 * abrupt speed changes at keyframe boundaries. `smoothstep` gives zero
 * velocity at both ends of every segment, so consecutive segments always
 * meet at matching (zero) velocity — no discontinuity to read as a
 * stutter — while `ScrollCameraRig.jsx`'s separate frame-rate-independent
 * damp layer still handles turning discrete scroll input into physically
 * continuous motion in real time; the two layers solve different problems
 * (spatial smoothness of the path itself vs. temporal response to input)
 * and neither replaces the other.
 */
const START_POSITION = new THREE.Vector3(-1.0, 1.6, 8)

// Establish look-at: the shared plinth ensemble's center, at a height
// between the two stands' own centers — used by both the entrance start
// and the Snap 1 establish point below, so that whole opening segment is
// a pure dolly-in (position changes, look direction doesn't) rather than
// a reframe, reading as a clean glide into the room.
const ESTABLISH_LOOKAT = new THREE.Vector3(MONITOR_ANCHOR.position[0], 1.3, MONITOR_ANCHOR.position[2])

// Snap 1 — Studio Scene (Establish): where the entrance glide settles,
// framing the Cinema Camera and Monitor stands side by side. Positioned
// directly in front of the shared beam center (BEAM_CENTER, the same
// point both stands are offset from — `plinthAnchor.js`) at a distance
// wide enough to comfortably fit both stands in frame together.
const ESTABLISH_DISTANCE = 3.0
const ESTABLISH_POSITION = new THREE.Vector3(BEAM_CENTER[0], 1.6, BEAM_CENTER[2] + ESTABLISH_DISTANCE)

const [lensX, lensY, lensZ] = CAMERA_ANCHOR.lensFrontFieldPosition
const [fwdX, , fwdZ] = CAMERA_ANCHOR.lensForward
const LENS_LOOKAT = new THREE.Vector3(lensX, lensY, lensZ)

// Approach: a medium-distance shot moving toward the Cinema Camera,
// looking at the same lens-front point Snap 2 will lock onto — so the
// flight from the establish shot onward reads as one continuous approach
// toward a single focal point rather than a jump between two targets.
const APPROACH_T = (ESTABLISH_T + FILM_FOCUS_T) / 2
const APPROACH_DISTANCE = 1.0
const APPROACH_POSITION = new THREE.Vector3(
  lensX + fwdX * APPROACH_DISTANCE,
  CAMERA_ANCHOR.bodyCenterHeight + 0.1,
  lensZ + fwdZ * APPROACH_DISTANCE,
)

// Snap 2 — Cinema Lens (Focus): the scroll sequence dives into the Cinema
// Camera's optical glass, per explicit request — close enough that the
// film media dominates the frame, with only a subtle border of the
// barrel/lip (CinemaCamera.jsx's lensLipGeometry) around the viewport's
// edge, per explicit request for a "deeper zoom" than the previous
// round's framing (creative-reference.md §6's "Lens transition...
// approach the lens closely enough that it becomes a dark circular
// visual field" taken further, toward "almost the entire screen").
// Distance is derived from the lens's own radius and this camera's fov
// (45°) so the lens disc subtends ~95% of the vertical half-frame —
// close/immersive while still keeping a comfortable margin past the near
// clip plane (near: 0.05, roughly a 2.7x safety margin at this distance).
const LENS_DIVE_FILL_FRACTION = 0.95
const LENS_DIVE_HALF_FOV_RADIANS = THREE.MathUtils.degToRad(45 / 2) * LENS_DIVE_FILL_FRACTION
const LENS_DIVE_DISTANCE = CAMERA_ANCHOR.lensRadius / Math.tan(LENS_DIVE_HALF_FOV_RADIANS)
const LENS_DIVE_POSITION = new THREE.Vector3(
  lensX + fwdX * LENS_DIVE_DISTANCE,
  lensY,
  lensZ + fwdZ * LENS_DIVE_DISTANCE,
)

// Snap 3 — Digital Monitor (Interface): framed close enough that the web
// interface fills most of the frame edge-to-edge, per explicit request —
// the same fill-fraction approach as the lens-dive keyframe above, just
// applied to the screen's own height instead of the lens radius. 0.92
// (vs. the lens's 0.95) leaves a touch more margin since the monitor's
// physical bezel — a real, deliberately visible object, unlike the lens's
// thin lip — needs to still read as a frame, not be cropped away.
const MONITOR_SNAP_FILL_FRACTION = 0.92
const MONITOR_SNAP_HALF_FOV_RADIANS = THREE.MathUtils.degToRad(45 / 2) * MONITOR_SNAP_FILL_FRACTION
const MONITOR_VIEW_DISTANCE = MONITOR_ANCHOR.screenHeight / 2 / Math.tan(MONITOR_SNAP_HALF_FOV_RADIANS)
const [screenX, screenY, screenZ] = MONITOR_ANCHOR.screenWorldPosition
const [screenFwdX, , screenFwdZ] = MONITOR_ANCHOR.screenForward
const MONITOR_ALIGNED_POSITION = new THREE.Vector3(
  screenX + screenFwdX * MONITOR_VIEW_DISTANCE,
  screenY,
  screenZ + screenFwdZ * MONITOR_VIEW_DISTANCE,
)
const MONITOR_ALIGNED_LOOKAT = new THREE.Vector3(screenX, screenY, screenZ)

const KEYFRAMES = [
  { t: 0, position: START_POSITION, lookAt: ESTABLISH_LOOKAT }, // Entrance start
  { t: ESTABLISH_T, position: ESTABLISH_POSITION, lookAt: ESTABLISH_LOOKAT }, // Snap 1 — Studio Scene
  { t: APPROACH_T, position: APPROACH_POSITION, lookAt: LENS_LOOKAT }, // Approach
  { t: FILM_FOCUS_T, position: LENS_DIVE_POSITION, lookAt: LENS_LOOKAT }, // Snap 2 — Cinema Lens
  { t: 1, position: MONITOR_ALIGNED_POSITION, lookAt: MONITOR_ALIGNED_LOOKAT }, // Snap 3 — Digital Monitor
]

/**
 * Pure function of `progress` only (no history/state) — deterministic and
 * therefore trivially reversible. Finds the two keyframes progress falls
 * between and linearly interpolates position/lookAt independently within
 * that segment only, after applying `smoothstep` to the segment's own
 * local progress — bezier-smooth ease-in/ease-out per segment, so every
 * keyframe boundary meets at zero velocity rather than an abrupt speed
 * change (see the module-level note above).
 */
export function sampleCameraPath(progress) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)

  let i = 0
  while (i < KEYFRAMES.length - 2 && p > KEYFRAMES[i + 1].t) i += 1
  const a = KEYFRAMES[i]
  const b = KEYFRAMES[i + 1]
  const rawSegmentT = b.t === a.t ? 0 : (p - a.t) / (b.t - a.t)
  const segmentT = THREE.MathUtils.smoothstep(rawSegmentT, 0, 1)

  const position = new THREE.Vector3().lerpVectors(a.position, b.position, segmentT)
  const lookAt = new THREE.Vector3().lerpVectors(a.lookAt, b.lookAt, segmentT)

  return {
    position: position.toArray(),
    lookAt: lookAt.toArray(),
  }
}
