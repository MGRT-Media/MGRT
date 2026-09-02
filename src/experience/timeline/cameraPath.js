import * as THREE from 'three'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'
import { CAMERA_ANCHOR } from '../film/CinemaCamera.jsx'
import { BEAM_CENTER, YAW_DEGREES, CAMERA_STAND } from '../digital/plinthAnchor.js'
import { PILLAR_RING_CENTER, PILLAR_RING_RADIUS, PILLAR_COUNT } from '../Environment.jsx'
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
 * Entrance: exterior orbit + gate entry — a second directorial pass on the
 * opening shot (superseding §4AX's half-moon-through-open-air version),
 * per explicit request to build the entrance around the room's now-full
 * pillar RING (`Environment.jsx`) rather than a half-moon that swept
 * through open floor: "we begin outside the architecture... keep the
 * camera outside and move around the perimeter... let them see the camera
 * and monitor through the gaps... then, as we reach roughly fifteen
 * degrees from the camera, find the gap between two pillars and move
 * through it."
 *
 * Two phases, both still living inside `t: 0 -> ESTABLISH_T` (the
 * existing Snap 1 boundary is unchanged — see the scope note below):
 *
 * **Phase 1 — exterior orbit.** The camera stays on a circle of its own
 * (`ORBIT_RADIUS`, concentric with the pillar ring, comfortably outside
 * it) and sweeps across `ORBIT_SWEEP_DEGREES` of arc before ever crossing
 * the ring. `ORBIT_START_POSITION` -> `ORBIT_A_POSITION` ->
 * `ORBIT_B_POSITION` -> `CHECKPOINT_POSITION` are four points along that
 * same circle — real angular positions, not a hand-tuned wandering path —
 * so the shape reads as one deliberate lap of the perimeter, not a
 * meandering flight.
 *
 * **Phase 2 — the gate.** `CHECKPOINT_POSITION` sits at exactly
 * `ENTRY_GATE_ANGLE + 15°` (the explicit "approximately 15° from the
 * camera" moment) — still on the orbit circle, this is the last pure-
 * orbit beat. From there, `GATE_POSITION` pulls the radius in from
 * `ORBIT_RADIUS` to `PILLAR_RING_RADIUS` over that final 15° of arc — the
 * camera visibly passes BETWEEN two real pillars rather than crossing the
 * ring at an arbitrary point, because `ENTRY_GATE_ANGLE` (below) is
 * computed from the ring's own geometry, not picked by eye. From the gate
 * onward the path hands off to the unchanged `ESTABLISH_POSITION` — no
 * new keyframe needed there, since the gate-to-establish leg is already a
 * short, natural continuation forward and slightly back toward center.
 *
 * `ENTRY_GATE_ANGLE` is deliberately DERIVED, not hardcoded: it re-runs
 * the same yaw/offset math `CinemaCamera.jsx` uses internally for its own
 * stand origin (not itself exported, since nothing else has needed it)
 * to find the Cinema Camera's true angular position around the pillar
 * ring's center, then snaps to the nearest real gap between two pillars —
 * "use the natural spacing between two pillars as the entrance... not an
 * artificial opening," per explicit request. If the ring's pillar count
 * or the Cinema Camera's placement ever changes, this keeps re-deriving
 * a real gate instead of silently pointing at empty stone.
 *
 * Height glides continuously from a high `ORBIT_START_Y` crane vantage
 * down to `GATE_Y` — already close to the existing Approach/Snap 2
 * shooting height — across all five new points, so (per explicit
 * request) there is no separate "final drop": the small remaining step
 * from `GATE_Y` to `ESTABLISH_POSITION`'s own `y` is a gentle last-inch
 * settle, not a beat of its own.
 *
 * Look-at follows the same "few distinct held targets" approach as
 * §4AX: `ORBIT_ENTRANCE_LOOKAT` (broad room/architecture, used once, at
 * the very start) hands off to `ORBIT_ENSEMBLE_LOOKAT` (the production
 * ensemble, held across the three subsequent orbit beats) which hands off
 * to the existing `ESTABLISH_LOOKAT` from the gate onward — three reframes
 * total across the whole entrance, not a target locked on frame-by-frame.
 * Combined with the camera's own position sweeping widely around a FIXED
 * look target during Phase 1, the framing evolves continuously on its
 * own without needing a moving target too — deliberately avoiding the
 * "perfect video-game orbit" the request explicitly warns against (a true
 * mechanical orbit also keeps a *constant radius and look target with no
 * other variation*; this one changes radius at the gate, changes height
 * throughout, and eases every segment — see `sampleCameraPath` below).
 *
 * Scope note: the request's own illustrative scroll percentages (§20)
 * describe the WHOLE journey from 0% to Film as one continuous circle-
 * then-enter shot, but also say explicitly these are "conceptual rather
 * than exact implementation requirements... the key is the sequence, not
 * the exact percentage." Compressing the full orbit-and-gate sequence
 * into the existing `t: 0 -> ESTABLISH_T` window (rather than restructuring
 * the whole intro zone up to `FILM_FOCUS_T`) keeps this a camera-path
 * change, not a scroll-timeline change — `ESTABLISH_T`'s Snap 1 pause and
 * everything from it onward (Approach, Snap 2's lens dive) are exactly
 * the existing, protected "interior Film approach" the request's own
 * Phase 2 describes, so reusing them unchanged already delivers that
 * half of the brief.
 */
function pointOnRing(angleDegrees, radius, y) {
  const angle = THREE.MathUtils.degToRad(angleDegrees)
  return new THREE.Vector3(
    PILLAR_RING_CENTER[0] + radius * Math.sin(angle),
    y,
    PILLAR_RING_CENTER[1] - radius * Math.cos(angle),
  )
}

// Re-derives the Cinema Camera stand's world origin — the same
// yaw + local-offset composition `CinemaCamera.jsx` computes internally
// for its own `worldOrigin`, which isn't exported since nothing else has
// needed it before now.
const cameraStandOrigin = new THREE.Vector3(CAMERA_STAND.offsetX, 0, 0)
  .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(YAW_DEGREES))
  .add(new THREE.Vector3(BEAM_CENTER[0], 0, BEAM_CENTER[2]))

const RING_STEP_DEGREES = 360 / PILLAR_COUNT

/** This point's angle around the pillar ring, in the same 0°-at-back-apex convention `Environment.jsx`'s own `pillarPositions` uses. */
function angleOnRing(point) {
  const dx = point.x - PILLAR_RING_CENTER[0]
  const dz = point.z - PILLAR_RING_CENTER[1]
  return (THREE.MathUtils.radToDeg(Math.atan2(dx, -dz)) + 360) % 360
}

// Pillars sit at multiples of RING_STEP_DEGREES (Environment.jsx); gaps
// between adjacent pillars therefore sit at the half-step offsets.
function nearestGapAngle(angleDegrees) {
  const halfStep = RING_STEP_DEGREES / 2
  const steps = Math.round((angleDegrees - halfStep) / RING_STEP_DEGREES)
  return (steps * RING_STEP_DEGREES + halfStep + 360) % 360
}

const ENTRY_GATE_ANGLE = nearestGapAngle(angleOnRing(cameraStandOrigin))

// Comfortably outside the pillar ring (whose own visual radius eats a
// little into PILLAR_RING_RADIUS) while staying inside the hall's own
// side walls at the orbit's widest points (θ: 90°/270°, where |x| equals
// this radius exactly, since PILLAR_RING_CENTER's x is 0).
const ORBIT_RADIUS = 6.2

// Total exterior sweep, start to the 15°-checkpoint below — comfortably
// more than half the ring, short of a full lap, per explicit "don't rush
//... but don't make the visitor wait excessively either."
const ORBIT_SWEEP_DEGREES = 250
const CHECKPOINT_OFFSET_DEGREES = 15

const orbitStartAngle = ENTRY_GATE_ANGLE + ORBIT_SWEEP_DEGREES
const checkpointAngle = ENTRY_GATE_ANGLE + CHECKPOINT_OFFSET_DEGREES

const ORBIT_START_Y = 4.4
const GATE_Y = 1.9

function angleAtOrbitFraction(f) {
  return orbitStartAngle - (orbitStartAngle - checkpointAngle) * f
}
function heightAtOrbitFraction(f) {
  return THREE.MathUtils.lerp(ORBIT_START_Y, GATE_Y, f)
}

const ORBIT_START_POSITION = pointOnRing(angleAtOrbitFraction(0), ORBIT_RADIUS, heightAtOrbitFraction(0))
const ORBIT_A_POSITION = pointOnRing(angleAtOrbitFraction(1 / 3), ORBIT_RADIUS, heightAtOrbitFraction(1 / 3))
const ORBIT_B_POSITION = pointOnRing(angleAtOrbitFraction(2 / 3), ORBIT_RADIUS, heightAtOrbitFraction(2 / 3))
const CHECKPOINT_POSITION = pointOnRing(angleAtOrbitFraction(1), ORBIT_RADIUS, heightAtOrbitFraction(1))
const GATE_POSITION = pointOnRing(ENTRY_GATE_ANGLE, PILLAR_RING_RADIUS, GATE_Y)

// Opening look direction — deliberately NOT the production ensemble.
// Aimed at the pillar ring's own center at a modest height, so the first
// thing the audience reads is the circular architecture itself, per
// explicit direction to let the circle "read clearly" before anything
// inside it is revealed.
const ORBIT_ENTRANCE_LOOKAT = new THREE.Vector3(PILLAR_RING_CENTER[0], 2.0, PILLAR_RING_CENTER[1])

// Held across the three subsequent orbit beats — the camera/lens and
// monitor "remain the primary visual subjects" per explicit request,
// achieved by holding this target fixed while the camera's own position
// sweeps widely around it (see the module doc above for why that reads
// as observed discovery, not a locked mechanical tracking shot).
const ORBIT_ENSEMBLE_LOOKAT = new THREE.Vector3(BEAM_CENTER[0], 1.8, BEAM_CENTER[2])

// Establish look-at: the shared plinth ensemble's center, at a height
// between the two stands' own centers — held from the gate through the
// establish point (a pure dolly for that final stretch, no further
// reframe) so the "found the gate, now approaching the ensemble" reveal
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
  { t: 0, position: ORBIT_START_POSITION, lookAt: ORBIT_ENTRANCE_LOOKAT }, // Exterior orbit start — high, outside the ring, reading the circle
  { t: 0.045, position: ORBIT_A_POSITION, lookAt: ORBIT_ENSEMBLE_LOOKAT }, // Orbit — counter-clockwise sweep, ensemble glimpsed through the gaps
  { t: 0.09, position: ORBIT_B_POSITION, lookAt: ORBIT_ENSEMBLE_LOOKAT }, // Orbit continues
  { t: 0.12, position: CHECKPOINT_POSITION, lookAt: ORBIT_ENSEMBLE_LOOKAT }, // ~15° from the gate — last pure-orbit beat
  { t: 0.135, position: GATE_POSITION, lookAt: ESTABLISH_LOOKAT }, // Through the gate — radius pulls in from the orbit to the ring itself
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
 * five distinct look targets exist across nine keyframes (several segments
 * intentionally share one, e.g. the three orbit beats all hold
 * `ORBIT_ENSEMBLE_LOOKAT`, and the gate through establish keeps looking at
 * `ESTABLISH_LOOKAT` — a pure dolly, no reframe), so there's no
 * meaningfully "kinked" rotation path to smooth the shape of the way
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
