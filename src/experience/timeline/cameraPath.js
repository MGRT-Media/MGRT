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
/**
 * Entrance arc (Entrance start -> Arc apex -> Snap 1 establish) — a
 * deliberate directorial redesign, per explicit request to think like a
 * filmmaker rather than solve an A-to-B interpolation problem. The
 * previous version was a near-straight, flat-height push down the room's
 * Z axis (start and establish shared the exact same y: 1.6, with only a
 * ~1.6-unit sideways drift) — technically smooth, but not a shot anyone
 * would direct.
 *
 * The new shape is a genuine half-moon: the camera opens HIGH (y: 4.4 —
 * roughly half the hall's own height, a real "crane" vantage that reads
 * the room's scale before anything else) and CENTERED BETWEEN the
 * entrance pillars (x: -1.6, keeping their existing "gateway the camera
 * passes through" framing intact), then sweeps in one broad, continuous
 * arc toward the room's lit side (bulging right, toward the breach/
 * beam — ARC_APEX_POSITION below) before curving back and settling into
 * the establish position — while continuously losing height the entire
 * way, so by the time it reaches the establish shot it has ALREADY
 * arrived at shooting height (1.6) rather than dropping into it. Three
 * points (start, apex, establish) are enough for CatmullRom to read as
 * one elegant crescent rather than a mechanical A-to-B-to-C — a second
 * apex point was considered and rejected as an S-curve, which is
 * explicitly the wrong shape here.
 *
 * The look-at direction tells its own, separate story (see
 * ENTRANCE_LOOKAT/ESTABLISH_LOOKAT below): the opening frame looks at the
 * room in general — space and light — not the plinths, so the ensemble
 * isn't revealed until the camera has already discovered the space around
 * it. That reframe happens over the Entrance -> Apex segment; from the
 * apex onward the camera holds on the plinth ensemble for a clean glide
 * to rest, exactly like the previous version's final approach did.
 */
const START_POSITION = new THREE.Vector3(-1.6, 4.4, 9.0)

// Broad crescent apex — the half-moon's outward bulge, swinging toward the
// room's lit (+X, breach/beam) side as the camera discovers the space,
// roughly midway down in both height and depth before curving back to the
// establish position's more centered x. Not a snap/lock point of its own
// (no `t` constant exported for it) — purely a shape control point for the
// spline, at t: 0.07, giving the sweep itself a bit more of the opening
// zone's short runway than the final glide-to-rest that follows it.
const ARC_APEX_T = 0.07
const ARC_APEX_POSITION = new THREE.Vector3(2.6, 2.4, 3.2)

// Opening look direction — deliberately NOT the plinth ensemble. Aimed
// generally into the room's depth at a modest height, so the first thing
// the audience reads is the space and its light, not the destination —
// per explicit direction not to reveal everything simultaneously.
const ENTRANCE_LOOKAT = new THREE.Vector3(0, 1.8, -2)

// Establish look-at: the shared plinth ensemble's center, at a height
// between the two stands' own centers — held from the arc apex through
// the establish point (a pure dolly for that final stretch, no further
// reframe) so the "architecture, then the production ensemble" reveal
// reads as one continuous settle, not a series of separate look-cuts.
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
  { t: 0, position: START_POSITION, lookAt: ENTRANCE_LOOKAT }, // Entrance start — high, wide, looking at the space itself
  { t: ARC_APEX_T, position: ARC_APEX_POSITION, lookAt: ESTABLISH_LOOKAT }, // Arc apex — the half-moon's outward sweep, reframing onto the ensemble
  { t: ESTABLISH_T, position: ESTABLISH_POSITION, lookAt: ESTABLISH_LOOKAT }, // Snap 1 — Studio Scene
  { t: APPROACH_T, position: APPROACH_POSITION, lookAt: LENS_LOOKAT }, // Approach
  { t: FILM_FOCUS_T, position: LENS_DIVE_POSITION, lookAt: LENS_LOOKAT }, // Snap 2 — Cinema Lens
  { t: 1, position: MONITOR_ALIGNED_POSITION, lookAt: MONITOR_ALIGNED_LOOKAT }, // Snap 3 — Digital Monitor
]

/**
 * The camera's spatial trajectory as one continuous spline threading
 * through every keyframe position, replacing per-segment straight-line
 * `lerpVectors` — per explicit request that the path "moves straight...
 * then takes a hard angle" and should instead read as "a smooth, rounded,
 * sweeping curve... continuous curvature." Straight segments joined at
 * keyframes were only C0-continuous in position: `smoothstep`-easing each
 * segment's local progress (still applied below) already made *speed*
 * C1-continuous at every keyframe (zero velocity at each boundary), but
 * did nothing for the *shape* of the path itself — the direction of
 * travel could still change abruptly at a keyframe, which is exactly the
 * "hard angle" being reported. `curveType: 'centripetal'` (Three.js's own
 * default, specified explicitly here) is deliberately used over the
 * uniform `'catmullrom'` type: with unevenly spaced control points like
 * these (the Approach and Lens Snap keyframes sit close together in
 * space; Establish and Monitor sit much farther out), a uniform
 * parameterization is prone to overshoot/looping between close points,
 * while centripetal stays well-behaved.
 *
 * `lookAt` is deliberately NOT put through the same curve treatment: only
 * four distinct look targets exist across six keyframes (several segments
 * intentionally share one, e.g. the arc apex through establish keeps
 * looking at `ESTABLISH_LOOKAT` — a pure dolly, no reframe), so there's
 * no meaningfully "kinked" rotation path to smooth the shape of the way
 * there is for position — segment-wise eased lerp between look targets
 * already reads as a smooth reframe, not a corner.
 */
const POSITION_CURVE = new THREE.CatmullRomCurve3(
  KEYFRAMES.map((k) => k.position),
  false,
  'centripetal',
)
const POSITION_SEGMENT_COUNT = KEYFRAMES.length - 1

/**
 * Pure function of `progress` only (no history/state) — deterministic and
 * therefore trivially reversible. Finds the two keyframes progress falls
 * between, applies `smoothstep` to that segment's own local progress —
 * bezier-smooth ease-in/ease-out per segment, so every keyframe boundary
 * meets at zero velocity rather than an abrupt speed change — and maps
 * the eased local value onto that same segment's span of the position
 * spline's own parameterization (each of `POSITION_SEGMENT_COUNT`
 * segments occupies an equal `1 / POSITION_SEGMENT_COUNT` span of the
 * curve's `u`), so the spline reaches each waypoint at exactly the same
 * progress value the old straight-line version did — only the shape
 * between waypoints changed, not the timing.
 */
export function sampleCameraPath(progress) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)

  let i = 0
  while (i < KEYFRAMES.length - 2 && p > KEYFRAMES[i + 1].t) i += 1
  const a = KEYFRAMES[i]
  const b = KEYFRAMES[i + 1]
  const rawSegmentT = b.t === a.t ? 0 : (p - a.t) / (b.t - a.t)
  const segmentT = THREE.MathUtils.smoothstep(rawSegmentT, 0, 1)

  const u = THREE.MathUtils.clamp((i + segmentT) / POSITION_SEGMENT_COUNT, 0, 1)
  const position = POSITION_CURVE.getPoint(u)
  const lookAt = new THREE.Vector3().lerpVectors(a.lookAt, b.lookAt, segmentT)

  return {
    position: position.toArray(),
    lookAt: lookAt.toArray(),
  }
}
