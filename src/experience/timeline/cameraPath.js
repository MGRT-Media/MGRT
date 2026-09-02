import * as THREE from 'three'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'
import { CAMERA_ANCHOR } from '../film/CinemaCamera.jsx'
import { BEAM_CENTER } from '../digital/plinthAnchor.js'
import { PILLAR_RING_CENTER, PILLAR_RING_RADIUS } from '../Environment.jsx'
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
 * Entrance: wide exterior half-circle, ending in perfect lens alignment,
 * then a genuinely straight interior approach — a fifth directorial pass
 * on the opening shot (refines §4BB/§4BA/§4AY's orbit; supersedes §4AX's
 * half-moon-through-open-air version). Two hard requirements this round:
 * push the exterior even further out and lower ("far back + low + wide"),
 * and — the more structurally significant change — guarantee that once
 * the camera passes through the pillar gap there is "only one movement:
 * straight forward... no additional curve... no second alignment."
 *
 * **The gate is derived from the lens's own optical axis, not the Cinema
 * Camera's position** (unchanged from §4BB): a ray cast from
 * `CAMERA_ANCHOR.lensFrontFieldPosition` along `CAMERA_ANCHOR.lensForward`
 * — the exact same axis `APPROACH_POSITION`/`LENS_DIVE_POSITION` already
 * sit on — crosses the pillar ring at `GATE_POSITION`
 * (`rayCircleIntersection`), landing ~12.7° clear of the nearest pillar
 * (confirmed via a standalone script before trusting it in-app).
 *
 * **The orbit is the antipodal half-circle from that gate**, at
 * `ORBIT_RADIUS` — pushed further out again, from §4BB's 6.8 to 6.9, per
 * explicit "move much further away... substantial space... this is
 * important." A standalone check confirmed the spline through evenly-
 * spaced circle points doesn't overshoot the nominal radius, so 6.9 is
 * genuinely close to the hard ceiling this room's ±7 walls impose on any
 * concentric circle here (see `ORBIT_RADIUS`'s own comment). Height
 * (`ORBIT_START_Y`/`GATE_Y`) is lowered again too, per explicit "lower
 * the camera further... grounded... pillars should feel tall and
 * imposing... do not make it excessively low."
 *
 * **The interior approach is now a genuine straight line, not just
 * collinear control points.** §4BB already made `GATE_POSITION`,
 * `APPROACH_POSITION`, and `LENS_DIVE_POSITION` mathematically collinear
 * (all on the lens axis), but that alone doesn't guarantee the SAMPLED
 * path stays straight: `ESTABLISH_POSITION` used to sit off-axis (a
 * two-shot centered on `BEAM_CENTER`, framing both stands), and even
 * after moving it onto the axis this round, a Catmull-Rom point's tangent
 * is influenced by its neighbors — the gate's "before" neighbor is the
 * last (off-axis) orbit point, which would still pull a small real curve
 * into the gate -> establish segment. `sampleCameraPath` below now
 * detects when both keyframes of a segment fall inside
 * `STRAIGHT_ZONE_START_INDEX..STRAIGHT_ZONE_END_INDEX` (gate through
 * lens-dive) and uses plain linear interpolation there instead of the
 * spline — a structural guarantee of "no additional curve after entering
 * the pillars," not a tuning target. `ESTABLISH_POSITION` itself moved
 * onto this same axis (see its own comment below) specifically so it
 * could be folded into this straight run rather than being a lingering
 * detour that would force a second alignment.
 *
 * Look-at: `ORBIT_ENTRANCE_LOOKAT` (the ring's own center, used once at
 * the start) hands off to `ORBIT_ENSEMBLE_LOOKAT` (near both the Cinema
 * Camera and Monitor, held through the middle orbit beats) which hands
 * off to `LENS_LOOKAT` — starting from the LAST orbit point, not the
 * gate — so orientation, like position, is already fully settled before
 * the camera ever reaches the gap. Every keyframe from there through
 * `LENS_DIVE_POSITION` holds that same `LENS_LOOKAT`: a pure dolly, zero
 * reframes, for the entire straight run.
 */
function pointOnRing(angleDegrees, radius, y) {
  const angle = THREE.MathUtils.degToRad(angleDegrees)
  return new THREE.Vector3(
    PILLAR_RING_CENTER[0] + radius * Math.sin(angle),
    y,
    PILLAR_RING_CENTER[1] - radius * Math.cos(angle),
  )
}

/** This point's angle around the pillar ring, in the same 0°-at-back-apex convention `Environment.jsx`'s own `pillarPositions` uses. */
function angleOnRing(point) {
  const dx = point.x - PILLAR_RING_CENTER[0]
  const dz = point.z - PILLAR_RING_CENTER[1]
  return (THREE.MathUtils.radToDeg(Math.atan2(dx, -dz)) + 360) % 360
}

/**
 * Where a ray (origin, direction — XZ only, Y ignored) first crosses a
 * circle of the given radius around `PILLAR_RING_CENTER`, travelling
 * forward (`t > 0`) from the origin. Standard ray-circle intersection;
 * picks the larger (farther) root, since the lens axis's ray also crosses
 * an imaginary circle of this radius a second time behind the camera body
 * (`t < 0`, irrelevant here).
 */
function rayCircleIntersection(originX, originZ, dirX, dirZ, radius) {
  const ox = originX - PILLAR_RING_CENTER[0]
  const oz = originZ - PILLAR_RING_CENTER[1]
  const a = dirX * dirX + dirZ * dirZ
  const b = 2 * (ox * dirX + oz * dirZ)
  const c = ox * ox + oz * oz - radius * radius
  const t = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
  return { x: originX + dirX * t, z: originZ + dirZ * t }
}

const [lensFrontX, , lensFrontZ] = CAMERA_ANCHOR.lensFrontFieldPosition
const [lensFwdX, , lensFwdZ] = CAMERA_ANCHOR.lensForward

// The straight corridor's ring crossing — see the module doc above for
// why this (not the Cinema Camera stand's own angular position) is the
// correct way to find "the gap aligned with the lens."
const gateCrossing = rayCircleIntersection(lensFrontX, lensFrontZ, lensFwdX, lensFwdZ, PILLAR_RING_RADIUS)
const ENTRY_GATE_ANGLE = angleOnRing(gateCrossing)

// Pushed out again from §4BB's 6.8, per explicit "much further away...
// substantial space... this is important." A standalone check confirmed
// the CatmullRom spline through evenly-spaced points on a true circle
// tracks the circle almost exactly (no meaningful overshoot beyond the
// nominal radius), so the only real ceiling is the hall's own ±7 side
// walls (`HALL_WIDTH` 14, unchanged/untouched — this is a camera-path
// round only): any half-circle from `ENTRY_GATE_ANGLE`'s antipodal point
// necessarily passes through one of the ring's two ±X extremes (θ: 90°/
// 270°, where |x| equals this radius exactly, since `PILLAR_RING_CENTER`'s
// x is 0) regardless of which arc is chosen. 6.9 is very close to that
// ceiling — a real but narrow 0.1 margin — which is as far as a single
// concentric circle can go in this room without touching the wall.
const ORBIT_RADIUS = 6.9

// Lowered again from §4BB (3.0 -> 2.2 start, 1.7 -> 1.0 at the gate) per
// explicit "lower the camera further... grounded... pillars should feel
// tall and imposing... do not make it excessively low." 2.2 sits just
// above human eye height — grounded without reading as a worm's-eye/
// Dutch-angle shot (no roll is ever applied anywhere in this file). 1.0
// at the gate continues descending toward, rather than jumping to,
// `APPROACH_POSITION`'s own real height (~0.94, derived from
// `CAMERA_ANCHOR.bodyCenterHeight` below) — the smallest remaining step
// this file has used yet for "no separate final drop."
const ORBIT_START_Y = 2.2
const GATE_Y = 1.0

const ORBIT_POINT_COUNT = 6
const HALF_CIRCLE_DEGREES = 180
const ORBIT_STEP_DEGREES = HALF_CIRCLE_DEGREES / ORBIT_POINT_COUNT

// Diametrically opposite the gate on the orbit's own circle — the start
// position is therefore a direct consequence of where the lens points,
// not an independently chosen coordinate. Stepping DOWN from here by
// `ORBIT_STEP_DEGREES` per point (same direction of travel established in
// §4AY/§4BA) sweeps through the room's deeper, darker side first.
const ORBIT_START_ANGLE = ENTRY_GATE_ANGLE + HALF_CIRCLE_DEGREES

function heightAtOrbitFraction(f) {
  return THREE.MathUtils.lerp(ORBIT_START_Y, GATE_Y, f)
}

const orbitPositions = Array.from({ length: ORBIT_POINT_COUNT }, (_, i) => {
  const angle = ORBIT_START_ANGLE - i * ORBIT_STEP_DEGREES
  const f = i / ORBIT_POINT_COUNT // < 1 even for the last point — it's one step short of the gate, not at it
  return pointOnRing(angle, ORBIT_RADIUS, heightAtOrbitFraction(f))
})
const GATE_POSITION = new THREE.Vector3(gateCrossing.x, GATE_Y, gateCrossing.z)

// Opening look direction — deliberately NOT the production ensemble.
// Aimed at the pillar ring's own center at a modest height, so the first
// thing the audience reads is the circular architecture itself, per
// explicit direction to let the circle "read clearly" before anything
// inside it is revealed.
const ORBIT_ENTRANCE_LOOKAT = new THREE.Vector3(PILLAR_RING_CENTER[0], 2.0, PILLAR_RING_CENTER[1])

// Held across the middle orbit beats — the Cinema Camera and Monitor
// "remain the primary visual subjects... visible somewhere within the
// frame throughout" per explicit request, achieved by holding this target
// (which sits near both of them) fixed while the camera's own position
// sweeps widely around it (see the module doc above for why that reads as
// observed discovery, not a locked mechanical tracking shot).
const ORBIT_ENSEMBLE_LOOKAT = new THREE.Vector3(BEAM_CENTER[0], 1.8, BEAM_CENTER[2])

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

// Snap 1 — Studio Scene (Establish): moved onto the lens axis this round
// (was previously a two-shot centered on `BEAM_CENTER`, off to the side of
// this line) — per explicit "once the camera passes through the pillar
// gap, there should be only one movement: straight forward... no second
// alignment." `ESTABLISH_DISTANCE` (2.2, between the gate crossing's own
// ~3.7 and `APPROACH_DISTANCE`'s 1.0) keeps this a genuine waypoint along
// the same corridor `GATE_POSITION`/`APPROACH_POSITION`/
// `LENS_DIVE_POSITION` already sit on, at a height continuing the same
// gentle descent (1.0 at the gate -> 0.97 here -> `APPROACH_POSITION`'s
// own ~0.94). The `ESTABLISH_T` scroll-snap pause itself
// (`filmActBeats.js`) is untouched — only where the camera physically is
// when it fires moved, same principle as the gate/orbit changes above.
const ESTABLISH_DISTANCE = 2.2
const ESTABLISH_POSITION = new THREE.Vector3(
  lensX + fwdX * ESTABLISH_DISTANCE,
  0.97,
  lensZ + fwdZ * ESTABLISH_DISTANCE,
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

// Orbit body keyframes span t: 0 -> 0.12 (six points, evenly spaced),
// leaving 0.12 -> 0.135 for the gate crossing and 0.135 -> ESTABLISH_T for
// the final settle — unchanged envelope from §4AY/§4BA, only the shape of
// the points inside it changed. The LAST orbit point already looks at
// `LENS_LOOKAT`, not `ORBIT_ENSEMBLE_LOOKAT` — per explicit "the camera
// should be correctly aligned before it enters the gap... no second
// alignment movement," the reframe onto the lens happens over this last
// (still exterior) orbit segment, so orientation is already settled by
// the time the gate itself is reached, matching the position alignment.
const ORBIT_BODY_T_END = 0.12
const orbitKeyframes = orbitPositions.map((position, i) => ({
  t: (ORBIT_BODY_T_END * i) / ORBIT_POINT_COUNT,
  position,
  lookAt: i === 0 ? ORBIT_ENTRANCE_LOOKAT : i === ORBIT_POINT_COUNT - 1 ? LENS_LOOKAT : ORBIT_ENSEMBLE_LOOKAT,
}))

const KEYFRAMES = [
  ...orbitKeyframes, // Antipodal start (t: 0) through the last pure-orbit point, one step short of the gate — already looking at the lens
  { t: 0.135, position: GATE_POSITION, lookAt: LENS_LOOKAT }, // Through the gate — radius pulls in from the orbit to the ring itself; look direction unchanged from the last orbit point
  { t: ESTABLISH_T, position: ESTABLISH_POSITION, lookAt: LENS_LOOKAT }, // Snap 1 — Studio Scene, now a waypoint on the same straight corridor
  { t: APPROACH_T, position: APPROACH_POSITION, lookAt: LENS_LOOKAT }, // Approach
  { t: FILM_FOCUS_T, position: LENS_DIVE_POSITION, lookAt: LENS_LOOKAT }, // Snap 2 — Cinema Lens
  { t: 1, position: MONITOR_ALIGNED_POSITION, lookAt: MONITOR_ALIGNED_LOOKAT }, // Snap 3 — Digital Monitor
]

// Index of GATE_POSITION within KEYFRAMES — everything from here through
// LENS_DIVE_POSITION (gate, establish, approach, lens-dive) sits on the
// same straight lens-axis line by construction (see the module doc
// above), so those three segments are sampled below with plain linear
// interpolation instead of the spline. This isn't a style choice: a
// Catmull-Rom point's tangent is influenced by ITS OWN neighbors, and the
// gate's "before" neighbor is the last (off-axis) orbit point — without
// this override, that would pull a small but real curve into the
// gate -> establish segment right where the request most explicitly
// prohibits one ("once the camera passes through the pillar gap... ONLY
// straight forward... no additional curve"). Every segment strictly
// after this straight run (lens-dive -> monitor) still uses the spline —
// that IS a genuine reframe toward a different destination, not a case
// the "no correction after entering" rule was ever about.
const STRAIGHT_ZONE_START_INDEX = ORBIT_POINT_COUNT // GATE_POSITION's index
const STRAIGHT_ZONE_END_INDEX = STRAIGHT_ZONE_START_INDEX + 3 // LENS_DIVE_POSITION's index

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
 * four distinct look targets exist across eleven keyframes (several
 * segments intentionally share one — every keyframe from the last orbit
 * point through `LENS_DIVE_POSITION` holds `LENS_LOOKAT`, a pure dolly,
 * no reframe), so there's no meaningfully "kinked" rotation path to smooth
 * the shape of the way there is for position — segment-wise eased lerp
 * between look targets already reads as a smooth reframe, not a corner.
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

  // Straight interior zone (gate through lens-dive): plain linear
  // interpolation, not the spline — see STRAIGHT_ZONE_START_INDEX's own
  // doc comment above for why the spline can't be trusted to stay
  // perfectly straight here even though its control points already are.
  const inStraightZone = i >= STRAIGHT_ZONE_START_INDEX && i < STRAIGHT_ZONE_END_INDEX
  const position = inStraightZone
    ? new THREE.Vector3().lerpVectors(a.position, b.position, segmentT)
    : POSITION_CURVE.getPoint(THREE.MathUtils.clamp((i + segmentT) / POSITION_SEGMENT_COUNT, 0, 1))
  const lookAt = new THREE.Vector3().lerpVectors(a.lookAt, b.lookAt, segmentT)

  return {
    position: position.toArray(),
    lookAt: lookAt.toArray(),
  }
}
