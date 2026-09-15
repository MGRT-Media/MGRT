import * as THREE from 'three'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'
import { CAMERA_ANCHOR } from '../film/CinemaCamera.jsx'
import { BEAM_CENTER } from '../digital/plinthAnchor.js'
import {
  WALL_INSCRIPTION,
  WALL_INSCRIPTION_CENTER,
  WALL_INSCRIPTION_NORMAL,
} from '../architecture/wallInscription.js'
import { PILLAR_RING_CENTER, PILLAR_RING_RADIUS } from '../Environment.jsx'
import { ESTABLISH_T, FILM_FOCUS_T, INTRO_ALIGN_T, JOURNEY_END_T, MONITOR_SNAP_T, HERO_T } from './filmActBeats.js'

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
 * Entrance: wide exterior orbit (~100° sweep, shortened from a full
 * half-circle per explicit request), ending in perfect lens alignment,
 * then a genuinely straight interior approach — a sixth directorial pass
 * on the opening shot (§4BD: fixes a real alignment bug in §4BC's orbit;
 * also refines §4BB/§4BA/§4AY; supersedes §4AX's half-moon-through-open-
 * air version).
 *
 * **§4BD's fix: the orbit's own endpoint, not just the gate, must sit on
 * the lens axis.** §4BC already derived `GATE_POSITION` from a ray cast
 * along `CAMERA_ANCHOR.lensForward` through the pillar ring, and made
 * `GATE_POSITION`/`APPROACH_POSITION`/`LENS_DIVE_POSITION` collinear — but
 * it placed the exterior orbit's LAST point using a fixed angular step
 * back from the INNER ring's own gate angle (`ENTRY_GATE_ANGLE +
 * ORBIT_STEP_DEGREES`), assuming that step would land close enough to
 * on-axis at the orbit's much larger radius. It doesn't: because the lens
 * axis doesn't pass through `PILLAR_RING_CENTER`, the angle at which it
 * crosses a circle is genuinely radius-dependent — computed and compared
 * both angles with a standalone script before writing this fix, and found
 * the orbit's true on-axis crossing (`ORBIT_ALIGN_ANGLE`, at
 * `ORBIT_RADIUS`) sits ~33° away from where §4BC's fixed-step scheme put
 * the last orbit point. That's the reported bug: a large, visible
 * misalignment right where "the exterior endpoint... perfectly aligned
 * with the Film lens" is the single hardest requirement. Fixed by casting
 * the SAME ray at `ORBIT_RADIUS` instead of `PILLAR_RING_RADIUS`
 * (`orbitAlignCrossing`) and using ITS angle as the orbit's own endpoint —
 * alignment is now exact by construction at whatever radius the orbit
 * actually uses, not an approximation that quietly degrades as the radius
 * grows.
 *
 * **The orbit sweeps `ORBIT_SWEEP_DEGREES` back from that same alignment
 * point**, at `ORBIT_RADIUS` — pushed further out again, from §4BC's 6.8
 * to 6.9, per explicit "much further away... substantial space... this is
 * important" — genuinely close to the hard ceiling this room's ±7 walls
 * impose on any concentric circle here (see `ORBIT_RADIUS`'s own
 * comment). Height (`ORBIT_START_Y`/`GATE_Y`) is lowered again too, per
 * explicit "lower the camera further... grounded... pillars should feel
 * tall and imposing... do not make it excessively low."
 *
 * **The interior approach is a genuine straight line, not just collinear
 * control points** (unchanged mechanism from §4BC, now starting one
 * keyframe earlier): `sampleCameraPath` below detects when both keyframes
 * of a segment fall inside `STRAIGHT_ZONE_START_INDEX..STRAIGHT_ZONE_END_INDEX`
 * — now the LAST ORBIT POINT through `LENS_DIVE_POSITION`, since that
 * orbit point is itself exactly on-axis this round — and uses plain
 * linear interpolation there instead of the spline. This isn't a style
 * choice: a Catmull-Rom point's tangent is influenced by its neighbors,
 * so even fully collinear control points don't guarantee a straight
 * SAMPLED path without this override.
 *
 * Look-at: `ORBIT_ENTRANCE_LOOKAT` (the ring's own center, used once at
 * the start) hands off to `ORBIT_ENSEMBLE_LOOKAT` (near both the Cinema
 * Camera and Monitor, held through the middle orbit beats) which hands
 * off to `LENS_LOOKAT` — starting from the LAST orbit point — so
 * orientation, like position, is already fully settled before the camera
 * ever reaches the gap. Every keyframe from there through
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

// Pushed out again from §4BD's 6.9 — this time with real room to do it in:
// `Environment.jsx`'s hall widened from 14 to 20 this round specifically
// because 6.9 left almost no margin (0.1) from the old ±7 walls, which is
// the opposite of "substantial open space between the camera and the
// nearest pillars." At the new ±10 walls, 9.0 leaves a genuinely
// comfortable 1.0 margin — nearly the whole width increase went straight
// into more real distance, not just more margin-of-error. Ring-to-orbit
// clearance also grew independently, from §4BD's 2.3 to 3.5 (`ORBIT_RADIUS`
// `9.0` minus the ring's own now-larger `PILLAR_RING_RADIUS`, `5.5`).
const ORBIT_RADIUS = 9.0

// §4BD fix — the exterior alignment angle: the SAME lens-axis ray crossed
// at `ORBIT_RADIUS` instead of `PILLAR_RING_RADIUS`. §4BC swept the orbit
// down to a fixed step short of the INNER ring's own gate angle
// (`gateCrossing`'s angle), on the assumption that a small fixed step
// would land close enough to on-axis at the orbit's much larger radius —
// it doesn't: because the lens axis doesn't pass through
// `PILLAR_RING_CENTER`, its crossing angle is genuinely radius-dependent.
// Computed and compared both angles with a standalone script before
// writing this fix: at `ORBIT_RADIUS` the true crossing was ~33° away
// from where §4BC's fixed-step scheme placed the last orbit point — a
// large, plainly visible misalignment right where the request says there
// must be none. Using this ray's own crossing as the orbit's endpoint
// makes alignment exact by construction, at whatever radius the orbit
// actually uses, instead of an approximation that quietly gets worse as
// the radius grows.
const orbitAlignCrossing = rayCircleIntersection(lensFrontX, lensFrontZ, lensFwdX, lensFwdZ, ORBIT_RADIUS)
const ORBIT_ALIGN_ANGLE = angleOnRing(orbitAlignCrossing)

// Lowered again from §4BD (2.2 -> 1.8 start, 1.0 -> 1.3 at the gate) per
// explicit "the vertical movement should be almost imperceptible compared
// with the horizontal circular movement... do not create a large
// crane-down movement." 1.8 sits right at ordinary human eye height —
// "looking across the room rather than down into it" is now close to
// literal: both `ORBIT_ENTRANCE_LOOKAT` (y: 2.0) and
// `ORBIT_ENSEMBLE_LOOKAT` (y: 1.8, below) sit almost level with this
// height, rather than notably below a much higher camera as in earlier
// rounds. The total exterior descent (1.8 -> 1.3, just 0.5) is
// deliberately smaller than §4BD's (2.2 -> 1.0, 1.2) even though the
// orbit itself is now much larger — height and horizontal scale are
// independent knobs, and this round only turns the first one down.
const ORBIT_START_Y = 1.8
const GATE_Y = 1.3

const ORBIT_POINT_COUNT = 6
// Shortened from a full 180° half-circle to ~100°, per explicit request —
// duration is untouched by this on its own: `ScrollTimelineProvider.jsx`'s
// `playIntroCinematic` duration formula only ever depends on progress-space
// distance (`INTRO_ALIGN_T`, unaffected by this constant), not real-world
// angular distance, so the same t: 0 -> INTRO_ALIGN_T sweep now covers a
// shorter arc over the exact same wall-clock time — slower, more
// deliberate angular movement, exactly the requested effect, with zero
// duration-side code changes required. `ORBIT_ALIGN_ANGLE` (the end of the
// sweep, where the camera lands exactly on the lens axis) is the fixed,
// protected point here, not the start — per explicit "do not change...
// Film camera position" and every prior round's alignment guarantee, so
// shortening the sweep moves the START point closer to the endpoint,
// leaving the endpoint itself, and everything downstream of it (the gate,
// the straight interior approach), completely untouched.
const ORBIT_SWEEP_DEGREES = 100
// (count - 1) intervals across `count` points, since the LAST point now
// lands exactly ON `ORBIT_ALIGN_ANGLE` — not one interval short of it,
// per the fix above — so there are only 5 gaps between 6 points.
const ORBIT_STEP_DEGREES = ORBIT_SWEEP_DEGREES / (ORBIT_POINT_COUNT - 1)

// `ORBIT_SWEEP_DEGREES` back from the exterior alignment point on the
// orbit's own circle — the start position is therefore a direct
// consequence of where the lens points, not an independently chosen
// coordinate. Stepping DOWN from here by `ORBIT_STEP_DEGREES` per point
// (same direction of travel established in §4AY/§4BA) sweeps through the
// room's deeper, darker side first, landing exactly at `ORBIT_ALIGN_ANGLE`
// on the final point.
const ORBIT_START_ANGLE = ORBIT_ALIGN_ANGLE + ORBIT_SWEEP_DEGREES

function heightAtOrbitFraction(f) {
  return THREE.MathUtils.lerp(ORBIT_START_Y, GATE_Y, f)
}

const orbitPositions = Array.from({ length: ORBIT_POINT_COUNT }, (_, i) => {
  const angle = ORBIT_START_ANGLE - i * ORBIT_STEP_DEGREES
  const f = i / (ORBIT_POINT_COUNT - 1) // reaches 1 exactly at the last point, which now IS the alignment point
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
// gentle descent (1.3 at the gate -> 0.97 here -> `APPROACH_POSITION`'s
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
// (45°) so the lens disc subtends ~99% of the vertical half-frame — the
// video reads as taking over almost the full viewport, per explicit
// follow-up request for a more dramatic "auto-zoom" on Film, still
// keeping a comfortable ~3.4x margin past the near clip plane (near:
// 0.05) — verified with a standalone script before raising this, since
// fill fraction and near-clip safety move in opposite directions as this
// number increases. Raised from 0.95, not replaced with a separate
// DOM/CSS zoom system: this dive is already exactly what that request
// describes — a smooth scale-up as the camera nears Film, bidirectional
// by construction since it's driven by the same scrollProgress-based
// sampleCameraPath every other camera movement uses — so the existing
// mechanism was tuned rather than duplicated.
const LENS_DIVE_FILL_FRACTION = 0.99
const LENS_DIVE_HALF_FOV_RADIANS = THREE.MathUtils.degToRad(45 / 2) * LENS_DIVE_FILL_FRACTION
const LENS_DIVE_DISTANCE = CAMERA_ANCHOR.lensRadius / Math.tan(LENS_DIVE_HALF_FOV_RADIANS)
/**
 * The ORIGINAL Film stop — no longer a keyframe, kept because it defines the
 * final leg's direction. It was built for a procedural lens that stood at
 * `lensFrontFieldPosition`; the real camera's face is 0.35 behind that point,
 * so this stop left the visitor 0.52 from the object they had walked to.
 */
const ORIGINAL_LENS_DIVE_POSITION = new THREE.Vector3(
  lensX + fwdX * LENS_DIVE_DISTANCE,
  lensY,
  lensZ + fwdZ * LENS_DIVE_DISTANCE,
)

/**
 * Snap 2's real stop: the same final leg, carried further forward.
 *
 * Nothing about the route changes. The approach -> Film leg is already a
 * straight line — on the lens axis horizontally, descending gently toward the
 * lens — and this keyframe simply sits further along that exact line, so the
 * move stays one straight dolly with no lateral step, no new curve and no new
 * vertical component. Extended, that line arrives within a few millimetres of
 * the camera face's own centre height, which is why it frames the lens rather
 * than the top of the housing.
 *
 * `FILM_STOP_FACE_DISTANCE` is measured from the camera's actual front face.
 * Chosen by eye against the rendered frame: at 0.15 the face fills roughly 85%
 * of the viewport's height, so the image dominates while the housing, the reel
 * above and the tripod rails still read around the edges. Closer loses the
 * object; further and the stop reads as standing in front of a camera rather
 * than arriving at it.
 */
// Measured on the camera at its original size, so it grows with the rig
// (`CAMERA_ANCHOR.rigScale`): the same face fill, and the same clearance from
// the housing that projects in front of the face.
const FILM_STOP_FACE_DISTANCE = 0.15 * CAMERA_ANCHOR.rigScale
const FILM_STOP_FACE = new THREE.Vector3().fromArray(CAMERA_ANCHOR.frontFacePosition)
const LENS_FORWARD = new THREE.Vector3().fromArray(CAMERA_ANCHOR.lensForward)
const FINAL_LEG_DIRECTION = new THREE.Vector3().subVectors(ORIGINAL_LENS_DIVE_POSITION, APPROACH_POSITION).normalize()
// Level with the face's centre. The extended leg used to land there by
// construction (0.795 against the face's 0.794); once the rig is scaled the
// leg's shape no longer does, so the height is taken from the face itself. The
// descent's waypoints are read off the line ending here (`onDescent`), so the
// whole leg stays one straight dolly.
const LENS_DIVE_POSITION = (() => {
  const approachDepth = new THREE.Vector3().subVectors(APPROACH_POSITION, FILM_STOP_FACE).dot(LENS_FORWARD)
  const along = (FILM_STOP_FACE_DISTANCE - approachDepth) / FINAL_LEG_DIRECTION.dot(LENS_FORWARD)
  return APPROACH_POSITION.clone().addScaledVector(FINAL_LEG_DIRECTION, along).setY(FILM_STOP_FACE.y)
})()

/**
 * The Film stop's own look target: straight ahead, level, down the lens axis.
 *
 * The corridor looks at `LENS_LOOKAT`, and the new stop is now PAST that point
 * — keeping it would turn the camera round. This target gives the stop exactly
 * the orientation the original stop had (level, facing the lens), and sits a
 * constant 1.0 ahead of the camera, which makes the look direction interpolate
 * linearly across the final leg instead of the old stop's late swing.
 */
const LENS_DIVE_LOOKAT = LENS_DIVE_POSITION.clone().addScaledVector(LENS_FORWARD, -1)

/**
 * The descent from outside the pillars to the lens, as one straight line.
 *
 * The gate, establish and approach waypoints already sat on the lens axis in
 * plan, but each carried its own height (1.3 -> 1.3 -> 0.97 -> 0.94 -> 0.795),
 * so the descent ran level, dropped, levelled and dropped again. Aimed at the
 * lens throughout, that nodded the view up and down between -3 and -6 degrees
 * — the rollercoaster. Their heights are now read off the straight line from
 * the exterior alignment point to the lens stop, which makes the whole leg a
 * single dolly toward the lens: no rises, no dips, one constant gradient. Both
 * ends are untouched — the orbit's last point and `LENS_DIVE_POSITION` — and
 * so is every waypoint's position in plan.
 */
const DESCENT_START = orbitPositions[ORBIT_POINT_COUNT - 1]
const DESCENT_PLAN_LENGTH = Math.hypot(LENS_DIVE_POSITION.x - DESCENT_START.x, LENS_DIVE_POSITION.z - DESCENT_START.z)

function onDescent(point) {
  const along = Math.hypot(point.x - DESCENT_START.x, point.z - DESCENT_START.z) / DESCENT_PLAN_LENGTH
  return new THREE.Vector3(point.x, THREE.MathUtils.lerp(DESCENT_START.y, LENS_DIVE_POSITION.y, along), point.z)
}

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
// Back to the monitor's own real screen height (`screenY`) for both
// position AND look-at — per explicit follow-up correcting §4BQ's
// over-correction: holding this whole hand-off at Film's lower `lensY`
// kept the camera perfectly level (good) but arrived too low to frame
// the monitor centered (not good). `screenY` is the physically correct
// height for a centered, on-axis shot of the monitor — see the Film ->
// Digital hand-off note below for how the rise TO this height stays
// perfectly level throughout, rather than reintroducing the tilt this
// same request forbids.
const MONITOR_ALIGNED_POSITION = new THREE.Vector3(
  screenX + screenFwdX * MONITOR_VIEW_DISTANCE,
  screenY,
  screenZ + screenFwdZ * MONITOR_VIEW_DISTANCE,
)
const MONITOR_ALIGNED_LOOKAT = new THREE.Vector3(screenX, screenY, screenZ)

// Film -> Digital hand-off: a quick pull-back away from the lens before
// pushing forward onto the monitor, per explicit request for that
// specific two-part beat ("slight pan/dolly backwards... followed by...
// dolly forwards... focusing in directly onto the monitor") rather than
// the single continuous dolly-out this hop used before. Retreats along
// the same lens-forward axis `APPROACH_POSITION`/`LENS_DIVE_POSITION`
// already sit on, to a distance between the two of them (deeper than
// `APPROACH_DISTANCE`, since this needs to read as its own deliberate
// widening beat, not just retrace the earlier approach) — a new value
// rather than literally reusing `APPROACH_POSITION`'s exact coordinate a
// second time: revisiting an identical point elsewhere in the same
// continuous Catmull-Rom spline risks an unpredictable tangent/curvature
// right where a clean, easily-reasoned-about retreat matters most.
// `HANDOFF_PULLBACK_T` sits close to `FILM_FOCUS_T` (`HANDOFF_PULLBACK_T_FRACTION`
// of the way through the Film->Digital span) so the retreat itself is
// quick — `sampleCameraPath` already gives every segment zero velocity at
// both ends (per-segment `smoothstep` easing), so the camera naturally
// settles to a brief stop at the peak of the pull-back before
// accelerating into the much longer forward push toward the monitor,
// without needing an explicit pause.
//
// Level rise, not a tilt: per explicit follow-up — "do not reintroduce
// the previous vertical camera-angle shift... keep the vertical viewing
// angle consistent... the correction should come from adjusting the
// camera's position/elevation, not by tilting the camera up or down" —
// this refines §4BQ's "hold everything at lensY" fix, which kept pitch
// at a constant zero but pinned it to the WRONG absolute height (too low
// to frame the monitor centered). The actual requirement is narrower
// than §4BQ read it as: pitch (the eye-to-target vertical ANGLE) must
// stay constant — specifically, always exactly level, zero — but the
// camera's own absolute ELEVATION is free to rise from `lensY` (Film's
// end) to `screenY` (the monitor's own, genuinely higher, correct
// framing height). The trick making that a genuine "level crane/pedestal
// rise" rather than a disguised tilt: `HANDOFF_PULLBACK_POSITION.y` and
// `HANDOFF_PULLBACK_LOOKAT.y` are set to the IDENTICAL value (an
// intermediate height between `lensY` and `screenY`, proportional to how
// far through the hand-off this keyframe sits — see
// `HANDOFF_PULLBACK_T_FRACTION`), and likewise `MONITOR_ALIGNED_POSITION.y`
// / `MONITOR_ALIGNED_LOOKAT.y` now match each other again (both
// `screenY`, above). Since every keyframe's position-Y equals that SAME
// keyframe's look-at-Y, and `VERTICAL_LOCK_ZONE_*` below forces BOTH
// through plain linear interpolation across identical per-segment
// start/end values, `position.y(t)` and `lookAt.y(t)` are literally the
// same function of segment progress at every sampled point, not just at
// keyframes — `eye.y - target.y` is exactly `0` throughout the entire
// hand-off, mathematically, even while the shared absolute height itself
// climbs. §4BQ's version instead held every Y at the single constant
// `lensY` (including the monitor's own final shot), which is what left
// the arrival too low — this version rises to the correct height while
// keeping the identical zero-pitch guarantee §4BQ established.
//
// `HANDOFF_PULLBACK_LOOKAT` keeps `ORBIT_ENSEMBLE_LOOKAT`'s X/Z
// (BEAM_CENTER, the point already used to frame both the Cinema Camera
// and Monitor together during the opening orbit — reused, not
// duplicated), only its Y is computed here, so the pull-back still
// horizontally reveals "the next destination" exactly as before — this
// round only touches the vertical component.
const HANDOFF_PULLBACK_T_FRACTION = 0.15
const HANDOFF_PULLBACK_T = FILM_FOCUS_T + (1 - FILM_FOCUS_T) * HANDOFF_PULLBACK_T_FRACTION
// From the Film stop's own height rather than `lensY`: with the rig scaled the
// corridor's look height sits above both ends, and rising from it would bob up
// and back down on the way to the monitor.
const HANDOFF_PULLBACK_Y = THREE.MathUtils.lerp(LENS_DIVE_POSITION.y, screenY, HANDOFF_PULLBACK_T_FRACTION)
const HANDOFF_PULLBACK_DISTANCE = 1.6
const HANDOFF_PULLBACK_POSITION = new THREE.Vector3(
  lensX + fwdX * HANDOFF_PULLBACK_DISTANCE,
  HANDOFF_PULLBACK_Y,
  lensZ + fwdZ * HANDOFF_PULLBACK_DISTANCE,
)
const HANDOFF_PULLBACK_LOOKAT = new THREE.Vector3(BEAM_CENTER[0], HANDOFF_PULLBACK_Y, BEAM_CENTER[2])

// Orbit body keyframes span t: 0 -> INTRO_ALIGN_T (six points, evenly
// spaced), leaving INTRO_ALIGN_T -> 0.135 for the gate crossing and
// 0.135 -> ESTABLISH_T for the final settle — unchanged envelope from
// §4AY/§4BA, only the shape of the points inside it changed.
// `INTRO_ALIGN_T` (imported from `filmActBeats.js`, not a local constant)
// is also exactly where `ScrollTimelineProvider.jsx`'s one-shot intro
// cinematic auto-play lands — the two files share this single value so
// they can't silently drift apart. The LAST orbit point already looks at
// `LENS_LOOKAT`, not `ORBIT_ENSEMBLE_LOOKAT` — per explicit "the camera
// should be correctly aligned before it enters the gap... no second
// alignment movement," the reframe onto the lens happens over this last
// (still exterior) orbit segment, so orientation is already settled by
// the time the gate itself is reached, matching the position alignment.
const orbitKeyframes = orbitPositions.map((position, i) => ({
  t: (INTRO_ALIGN_T * i) / (ORBIT_POINT_COUNT - 1),
  position,
  lookAt: i === 0 ? ORBIT_ENTRANCE_LOOKAT : i === ORBIT_POINT_COUNT - 1 ? LENS_LOOKAT : ORBIT_ENSEMBLE_LOOKAT,
}))


/* ------------------------------------------------------------------ */
/* Digital -> MGRT hero: the interior traversal                         */
/* ------------------------------------------------------------------ */

/**
 * The wall the room is travelling toward.
 *
 * Read from `WALL_INSCRIPTION` rather than restated, so the hero framing
 * tracks the wordmark if it is ever re-laid-out. The dolly axis is the wall's
 * plan normal with its vertical component dropped: the inscription's surface
 * tips up by about a degree, and following that exactly would put the camera
 * fractionally above its own look-at and reintroduce the pitch this project
 * keeps at zero for level moves.
 */
const HERO_CENTER = new THREE.Vector3(...WALL_INSCRIPTION_CENTER)
const HERO_AXIS = new THREE.Vector3(WALL_INSCRIPTION_NORMAL[0], 0, WALL_INSCRIPTION_NORMAL[2]).normalize()

/**
 * Half the width of the widest line of the wordmark, in world units.
 *
 * 0.96 of the band, not the 0.9 that `LINES` asks the canvas for. That figure
 * is the text's ADVANCE width; the painted ink runs wider than its advance
 * once the tracking and the final glyph's side bearing are counted. Framing
 * against 0.9 put the wordmark at a measured 96% of the frame with its outer
 * letters almost touching the edges — this is the correction, taken off the
 * rendered frame rather than off the spec.
 */
const HERO_HALF_WIDTH = (WALL_INSCRIPTION.width * 0.96) / 2

/**
 * How much of the frame's width the wordmark is asked to occupy.
 *
 * Same construction as `MONITOR_SNAP_FILL_FRACTION` and
 * `LENS_DIVE_FILL_FRACTION`: the fraction scales the half-FOV, and the
 * distance falls out of it. 0.92 leaves a little air either side.
 */
const HERO_FILL_FRACTION = 0.92

/**
 * The furthest the camera may stand off the wall, and this is an OCCLUSION
 * limit rather than a collision one.
 *
 * Two limits meet here and the tighter one wins.
 *
 * Measured against the real ring at the true glyph width, past 10.25 units
 * the sightlines from the
 * camera to the outer letters start clipping the columns at (0, -9.5) and
 * (-2.75, -8.76), so the colonnade begins crossing the wordmark. The camera
 * has plenty of physical room beyond that — it is the READ that fails first.
 */
const HERO_MAX_DISTANCE = 8.6
/** Closest approach, so a very wide viewport cannot push into the wall. */
const HERO_MIN_DISTANCE = 3.4

/**
 * Distance from the wall for the hero frame, solved for the live aspect.
 *
 * The wordmark is roughly 4.2:1. A landscape viewport is far squarer than
 * that, so WIDTH is always the binding constraint and the distance is solved
 * from the horizontal half-FOV. That also means the requirement grows sharply
 * as the viewport narrows — and past a point it cannot be met at all, because
 * the distance needed to fit the wordmark is further back than the columns
 * allow. Clamping at `HERO_MAX_DISTANCE` is the deliberate choice there: the
 * frame keeps a clean, unobstructed view of the wall rather than a complete
 * wordmark seen through a colonnade.
 *
 * 8.6 rather than that 10.25 is the approved framing on the narrowest
 * viewports. It was first set with a margin for a later hand-over that no
 * longer exists, and is kept so the hero's composition on a phone is exactly
 * the one that was signed off.
 */
export function heroDistanceForAspect(aspect) {
  const halfFovY = THREE.MathUtils.degToRad(45 / 2)
  const halfFovX = Math.atan(Math.tan(halfFovY) * Math.max(aspect, 0.2))
  const required = HERO_HALF_WIDTH / Math.tan(halfFovX * HERO_FILL_FRACTION)
  return THREE.MathUtils.clamp(required, HERO_MIN_DISTANCE, HERO_MAX_DISTANCE)
}

/** Camera position for the hero frame at a given stand-off. */
function heroPositionAt(distance) {
  return new THREE.Vector3(
    HERO_CENTER.x + HERO_AXIS.x * distance,
    HERO_CENTER.y,
    HERO_CENTER.z + HERO_AXIS.z * distance,
  )
}

export const HERO_LOOKAT = HERO_CENTER.clone()

/**
 * The traversal from the monitor to the wall.
 *
 * **Route.** The straight line from the Digital endpoint to the wall runs
 * through the monitor, so the camera has to go around the ensemble. It goes
 * round the SHADED side, and the first attempt did the opposite: a near
 * vertical crane straight up off the monitor and then forward. That cleared
 * everything by a mile and read as a drone taking off. What replaced it eases
 * back off the screen, trucks left across the open floor BEHIND both props —
 * the only band where the monitor and the camera asset are not side by side —
 * and then runs the length of the room, gaining height the whole way.
 *
 * The +X side was tried and abandoned: the corridor between the monitor at
 * x 1.4 and the ring column at (2.75, -8.76) is narrow enough that every
 * variant traded prop clearance for pillar clearance, and the widest of them
 * put the spline through the column.
 *
 * **Height is spread across the whole move** — 1.195 to 3.6 over about
 * eighteen units of travel, an average climb of well under ten degrees — so
 * the rise reads as a pedestal riding along with the dolly rather than as a
 * lift.
 *
 * **The camera stays level throughout.** Every look-at below sits at its own
 * keyframe's height, so pitch is zero the whole way and the wordmark is met
 * head-on at its own eyeline rather than being tilted up to. Yaw is what
 * carries the discovery: the frame leaves the monitor, swings onto the
 * colonnade, picks up the wall obliquely, and only squares up over the last
 * two keyframes, where the move becomes a pure dolly along `HERO_AXIS`.
 *
 * **Clearances are measured against the real spline**, not the polyline —
 * a Catmull-Rom bows outside its control points, and an earlier route that
 * was clear as a polyline passed 0.10 from the camera asset once curved.
 */
const HERO_PRE_DOLLY_LEAD = 1.3

// `HERO_T` lives in `filmActBeats.js` with the other beats — see the note
// there on the import cycle that forced the move. Re-exported so the modules
// already reading it from here keep working.
export { HERO_T }

/** Set when keyframes move, so the glides re-measure their length. See `GLIDES`. */
let glideLengthsStale = true
/** Set when keyframes move, so the whole-path distance table is re-measured. */
let pathArcStale = true

const heroPreDollyKeyframe = { t: 0.876, position: heroPositionAt(0), lookAt: HERO_LOOKAT }
// The last keyframe of the journey (`JOURNEY_END_T`).
const heroKeyframe = { t: HERO_T, position: heroPositionAt(0), lookAt: HERO_LOOKAT }

/**
 * The route from the monitor to the hero: one shallow curve onto the hero's own
 * axis, then straight in along it.
 *
 * It used to swing out through a half-circle to x = -1.4 beside the monitor
 * and on to -1.78 halfway down the room — well left of the hero, which stands
 * near -1 — before bending back right to settle on the wordmark: a sideways
 * detour and a corrective turn. Nothing in the room asks for it. The only
 * obstacles on the way are the film camera and the computer, and the camera
 * can pass between them.
 *
 * Now the camera slides left off the screen (easing back a touch so it clears
 * the lid), threads the ~1.2m gap between the film camera and the computer,
 * and turns steadily onto the hero axis, joining it at `APPROACH_JOIN_DISTANCE`
 * from the wall. From there it is the hero's own dolly. Throughout:
 *  - it only ever moves left and turns right: x never increases and the
 *    heading turns one way, so there is no excursion to correct;
 *  - it approaches the axis from the monitor's side and never crosses it.
 *
 * The curve is a cubic Bézier whose end handle lies along the axis, so it
 * meets the straight run with the same heading. Its handles were chosen for
 * the lowest peak curvature (about 60 degrees per metre, in the first metre
 * while the camera is still gathering speed) that still keeps 0.5m of plan
 * clearance from the film camera and the lid — the gap does not allow more. Pace comes from `GLIDES` (distance along the route), and height and
 * view direction are eased over the whole glide, so the `t` values and the
 * heights and aims written into these waypoints only order and describe them.
 */
const APPROACH_JOIN_DISTANCE = 12.2 // beyond every aspect's pre-dolly point (at most HERO_MAX_DISTANCE + HERO_PRE_DOLLY_LEAD = 9.9)
const APPROACH_START_HEADING_DEGREES = -105 // left, easing slightly back from the screen
const APPROACH_START_HANDLE = 1.8
const APPROACH_JOIN_HANDLE = 1.75
const APPROACH_WAYPOINT_COUNT = 14

const approachJoin = heroPositionAt(APPROACH_JOIN_DISTANCE).setY(0)
const approachStartHeading = THREE.MathUtils.degToRad(APPROACH_START_HEADING_DEGREES)
const approachCurve = new THREE.CubicBezierCurve3(
  new THREE.Vector3(MONITOR_ALIGNED_POSITION.x, 0, MONITOR_ALIGNED_POSITION.z),
  new THREE.Vector3(
    MONITOR_ALIGNED_POSITION.x + Math.sin(approachStartHeading) * APPROACH_START_HANDLE,
    0,
    MONITOR_ALIGNED_POSITION.z - Math.cos(approachStartHeading) * APPROACH_START_HANDLE,
  ),
  approachJoin.clone().addScaledVector(HERO_AXIS, APPROACH_JOIN_HANDLE),
  approachJoin,
)

// Evenly spaced along the curve, so the position spline follows it closely
// rather than cutting between sparse points. Each takes the eased height and
// aim for its share of the whole route (measured to the 16:9 hero).
const approachCurveLength = approachCurve.getLength()
const approachRouteLength = approachCurveLength + APPROACH_JOIN_DISTANCE - heroDistanceForAspect(16 / 9)
const heroTraversalWaypoints = approachCurve
  .getSpacedPoints(APPROACH_WAYPOINT_COUNT)
  .slice(1)
  .map((point, i) => {
    const along = (approachCurveLength * (i + 1)) / APPROACH_WAYPOINT_COUNT
    const weight = THREE.MathUtils.smoothstep(along / approachRouteLength, 0, 1)
    const position = point.setY(THREE.MathUtils.lerp(MONITOR_ALIGNED_POSITION.y, HERO_CENTER.y, weight))
    const aim = new THREE.Vector3()
      .subVectors(MONITOR_ALIGNED_LOOKAT, MONITOR_ALIGNED_POSITION)
      .setY(0)
      .normalize()
      .lerp(HERO_AXIS.clone().negate(), weight)
      .normalize()
    return {
      t: THREE.MathUtils.lerp(MONITOR_SNAP_T, heroPreDollyKeyframe.t, (i + 1) / (APPROACH_WAYPOINT_COUNT + 1)),
      position,
      lookAt: position.clone().addScaledVector(aim, 6),
    }
  })

const heroTraversalKeyframes = [...heroTraversalWaypoints, heroPreDollyKeyframe, heroKeyframe]


/**
 * Re-solves the hero stand-off for the current viewport and writes it into the
 * last two keyframes.
 *
 * Mutation rather than a rebuilt array on purpose: `sampleCameraPathInto` is
 * called every frame and reads these objects directly, so moving the two
 * vectors is the whole update — no reallocation, nothing to invalidate, and
 * the allocation-free sampling path stays allocation-free.
 *
 * Only the last two move, and they move ALONG `HERO_AXIS` together, so the
 * final stretch stays a pure dolly on the wall normal at every aspect ratio.
 * `ScrollCameraRig` calls this when the camera's aspect actually changes.
 */
export function setHeroAspect(aspect) {
  glideLengthsStale = true
  pathArcStale = true
  const distance = heroDistanceForAspect(aspect)
  heroKeyframe.position.copy(heroPositionAt(distance))
  heroPreDollyKeyframe.position.copy(heroPositionAt(distance + HERO_PRE_DOLLY_LEAD))
}

setHeroAspect(16 / 9)

const KEYFRAMES = [
  ...orbitKeyframes, // Antipodal start (t: 0) through the exterior alignment point (t: 0.12) — already on-axis and looking at the lens
  { t: 0.135, position: onDescent(GATE_POSITION), lookAt: LENS_LOOKAT }, // Through the gate — radius pulls in from the orbit to the ring itself, same axis, same look direction
  { t: ESTABLISH_T, position: onDescent(ESTABLISH_POSITION), lookAt: LENS_LOOKAT }, // Snap 1 — Studio Scene, a waypoint on the same straight corridor
  { t: APPROACH_T, position: onDescent(APPROACH_POSITION), lookAt: LENS_LOOKAT }, // Approach
  { t: FILM_FOCUS_T, position: LENS_DIVE_POSITION, lookAt: LENS_DIVE_LOOKAT }, // Snap 2 — Cinema Lens
  { t: HANDOFF_PULLBACK_T, position: HANDOFF_PULLBACK_POSITION, lookAt: HANDOFF_PULLBACK_LOOKAT }, // Film -> Digital hand-off: quick pull-back, vertically locked to lensY
  { t: MONITOR_SNAP_T, position: MONITOR_ALIGNED_POSITION, lookAt: MONITOR_ALIGNED_LOOKAT }, // Snap 3 — Digital Monitor
  // Digital -> MGRT hero, the journey's final move.
  ...heroTraversalKeyframes,
]

// Index of the LAST ORBIT POINT within KEYFRAMES — since §4BD's fix makes
// that point itself land exactly on the lens axis (not just the gate that
// follows it), the straight-line guarantee now starts one keyframe
// earlier than in §4BC: this segment (last orbit point -> gate) and
// everything through LENS_DIVE_POSITION (gate, establish, approach,
// lens-dive) all sit on the same straight lens-axis line by construction
// (see the module doc above), so those four segments are sampled below
// with plain linear interpolation instead of the spline. This isn't a
// style choice: a Catmull-Rom point's tangent is influenced by ITS OWN
// neighbors, and without this override the curved orbit's own approach
// direction would still pull a small but real curve into the segments
// right after it — exactly where the request most explicitly prohibits
// one ("once the camera passes through the pillar gap... ONLY straight
// forward... no additional curve"). Every segment strictly before this
// zone (the curved orbit itself) still uses the spline — that IS a
// genuine directional change, not a case the "no correction after
// entering" rule was ever about. `STRAIGHT_ZONE_END_INDEX` is computed,
// not a literal — appending the hand-off pull-back keyframe after
// `LENS_DIVE_POSITION` (rather than before it) left this arithmetic, and
// therefore the straight-line guarantee itself, untouched.
const STRAIGHT_ZONE_START_INDEX = ORBIT_POINT_COUNT - 1 // last orbit point's index
const STRAIGHT_ZONE_END_INDEX = STRAIGHT_ZONE_START_INDEX + 4 // LENS_DIVE_POSITION's index

// The Film -> Digital hand-off's own two segments (lens-dive -> pull-back,
// pull-back -> monitor) — forced to plain linear interpolation for the
// same underlying reason as the straight zone above, but for a different
// requirement: every keyframe's position-Y in this span is set to exactly
// match that SAME keyframe's look-at-Y (see the hand-off's own comment —
// a level rise from `lensY` to `screenY`, not a flat hold), but Catmull-Rom's
// segment shape is influenced by neighboring control points OUTSIDE the
// two endpoints too (here, `APPROACH_POSITION`, one segment before this
// zone starts, which sits at a different height than either) — so equal
// position/look-at Y values at each keyframe alone wouldn't guarantee the
// *sampled* position curve tracks the (always-linear) look-at curve
// exactly in between, which is what the zero-pitch guarantee actually
// depends on. Only forcing straight-line interpolation for position too
// makes them the same function of segment progress everywhere, not just
// at the endpoints. Kept as its own named zone rather than folded into
// `STRAIGHT_ZONE_*` above: that one
// exists to keep the interior approach genuinely straight (a positional
// concern); this one exists to keep the hand-off's pitch (not its
// elevation) exactly level throughout (a separate, angle-only concern) —
// different "why", same underlying `lerpVectors` mechanism.
const VERTICAL_LOCK_ZONE_START_INDEX = STRAIGHT_ZONE_END_INDEX // LENS_DIVE_POSITION's index
const VERTICAL_LOCK_ZONE_END_INDEX = VERTICAL_LOCK_ZONE_START_INDEX + 2 // MONITOR_ALIGNED_POSITION's index

/**
 * The glide: the Digital keyframe through to the hero.
 *
 * This stretch is a curved route around architecture, so forcing `lerpVectors`
 * across it would turn the waypoints into corners. The zone does two things, and the second matters more than the first:
 *
 *  - position comes from the Catmull-Rom curve, so the route is a curve
 *    through the waypoints rather than a polyline between them;
 *  - segment progress is used RAW rather than through `smoothstep`.
 *
 * That second point is the difference between a camera move and six camera
 * moves. Everywhere else in this path, per-segment `smoothstep` is exactly
 * right: each keyframe is a beat the camera settles on, and meeting them at
 * zero velocity is the intent. Applied to a continuous traversal it means the
 * camera stops dead at every waypoint and sets off again — six ease-in-outs
 * back to back, which reads as lurching, not gliding. Inside the glide the
 * segments run at constant local speed and the whole move is shaped once, by
 * `glideEase` below.
 */
const GLIDE_ZONE_START_INDEX = KEYFRAMES.findIndex((k) => k.t === MONITOR_SNAP_T)
const GLIDE_ZONE_END_INDEX = KEYFRAMES.length - 1

/**
 * The velocity profile of the whole traversal, applied once.
 *
 * `smootherstep` rather than `smoothstep`: it is zero in both the first AND
 * second derivative at each end, so the camera leaves the monitor with no
 * jerk and arrives at the hero with none either. `smoothstep` only flattens
 * velocity, which leaves a perceptible kick at the moment the move starts —
 * the exact tell that separates an operated camera from an interpolated one.
 *
 * The long tail is the brief's "progressive deceleration": most of the last
 * third of the scroll distance is spent covering very little ground, so the
 * wordmark settles into frame instead of hitting its mark.
 */
function glideEase(u) {
  return u * u * u * (u * (u * 6 - 15) + 10)
}

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

/** Position on segment `i` at local fraction `f`, with that segment's own interpolation. */
function segmentPositionInto(i, f, out) {
  const inStraightZone = i >= STRAIGHT_ZONE_START_INDEX && i < STRAIGHT_ZONE_END_INDEX
  const inVerticalLockZone = i >= VERTICAL_LOCK_ZONE_START_INDEX && i < VERTICAL_LOCK_ZONE_END_INDEX
  if (inStraightZone || inVerticalLockZone) {
    out.lerpVectors(KEYFRAMES[i].position, KEYFRAMES[i + 1].position, f)
  } else {
    // `getPoint`'s second argument is an optional target — passing it is what
    // keeps the curve evaluation allocation-free.
    POSITION_CURVE.getPoint(THREE.MathUtils.clamp((i + f) / POSITION_SEGMENT_COUNT, 0, 1), out)
  }
}

/**
 * The two travelling moves, each shaped ONCE and paced by distance.
 *
 * Everywhere else each keyframe is a beat the camera settles on, so every
 * segment is eased on its own. That is wrong for a journey. The descent from
 * the pillars to the lens crossed three waypoints (gate, establish, approach)
 * and stopped dead at each, and its keyframe times bore no relation to the
 * distances between them — six of its 8.4 units went by in the first tenth of
 * the leg, the last 2.4 took the rest. The hero traversal was eased once, but
 * still paced by hand-spaced keyframe times, which leaves speed steps wherever
 * the spacing and the curve's own parameter speed disagree.
 *
 * Inside a glide, progress is eased once with `glideEase` and that value is
 * taken as a fraction of the leg's measured LENGTH. The camera therefore moves
 * along the real route with one smooth speed profile — zero velocity and
 * acceleration at both ends, one peak in the middle — however the waypoints
 * are spaced. Waypoints still decide the shape of the route and when each
 * look-at applies (by where the camera is, not by when); their `t` values
 * inside a glide no longer set its pace.
 */
const GLIDE_SAMPLES_PER_SEGMENT = 64
const GLIDES = [
  { startT: INTRO_ALIGN_T, endT: FILM_FOCUS_T, startIndex: STRAIGHT_ZONE_START_INDEX, endIndex: STRAIGHT_ZONE_END_INDEX },
  // Rises 2.4 and turns 15.5 degrees over ~15 of travel through a swing, so
  // height and heading each get their own ease rather than whatever the
  // spline and the waypoint aims make of them in between.
  { startT: MONITOR_SNAP_T, endT: HERO_T, startIndex: GLIDE_ZONE_START_INDEX, endIndex: KEYFRAMES.indexOf(heroKeyframe), eased: true },
].map((glide) => ({
  ...glide,
  lengths: new Float32Array((glide.endIndex - glide.startIndex) * GLIDE_SAMPLES_PER_SEGMENT + 1),
  // A glide that starts from rest gets a spline through its own waypoints
  // only. Sharing `POSITION_CURVE` let the keyframe BEFORE the glide — the
  // Film hand-off the camera arrived from — bend the curve's tangent at the
  // start, so the approach to the hero set off at the wrong heading and
  // S-bent back onto its route in the first half-metre. Its own curve starts
  // along the route. (Same vector objects, so `setHeroAspect` still moves it.)
  curve: glide.eased
    ? new THREE.CatmullRomCurve3(KEYFRAMES.slice(glide.startIndex, glide.endIndex + 1).map((k) => k.position), false, 'centripetal')
    : null,
}))
if (GLIDES.some((g) => KEYFRAMES[g.startIndex].t !== g.startT || KEYFRAMES[g.endIndex].t !== g.endT)) {
  throw new Error('cameraPath: glide keyframe indices no longer match their progress range')
}

const glidePointScratch = new THREE.Vector3()
const glideAimA = new THREE.Vector3()
const glideAimB = new THREE.Vector3()
const glidePreviousScratch = new THREE.Vector3()

function glidePositionInto(glide, i, f, out) {
  if (!glide.curve) {
    segmentPositionInto(i, f, out)
    return
  }
  glide.curve.getPoint(THREE.MathUtils.clamp((i - glide.startIndex + f) / (glide.endIndex - glide.startIndex), 0, 1), out)
}

function measureGlides() {
  for (const glide of GLIDES) {
    glidePositionInto(glide, glide.startIndex, 0, glidePreviousScratch)
    let total = 0
    for (let k = 1; k < glide.lengths.length; k += 1) {
      const local = k / GLIDE_SAMPLES_PER_SEGMENT
      const i = Math.min(glide.startIndex + Math.floor(local), glide.endIndex - 1)
      glidePositionInto(glide, i, local - (i - glide.startIndex), glidePointScratch)
      total += glidePointScratch.distanceTo(glidePreviousScratch)
      glidePreviousScratch.copy(glidePointScratch)
      glide.lengths[k] = total
    }
  }
  glideLengthsStale = false
}

/** Writes the glide pose for progress `p`; returns false when `p` is outside every glide. */
function sampleGlideInto(p, outPosition, outLookAt) {
  let glide = null
  for (const candidate of GLIDES) if (p >= candidate.startT && p <= candidate.endT) glide = candidate
  if (!glide) return false
  if (glideLengthsStale) measureGlides()

  const { lengths } = glide
  const target = glideEase((p - glide.startT) / (glide.endT - glide.startT)) * lengths[lengths.length - 1]
  let lo = 0
  let hi = lengths.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (lengths[mid] <= target) lo = mid
    else hi = mid
  }
  const span = lengths[hi] - lengths[lo]
  const local = (lo + (span > 0 ? (target - lengths[lo]) / span : 0)) / GLIDE_SAMPLES_PER_SEGMENT
  const i = Math.min(glide.startIndex + Math.floor(local), glide.endIndex - 1)
  const f = local - (i - glide.startIndex)

  glidePositionInto(glide, i, f, outPosition)

  // Blend the view DIRECTION, not the look-at point. Blending points mixes
  // how far away each target is into the aim — the monitor's target is the
  // screen 0.67 ahead, the next waypoint's is metres off — so the view swung
  // between waypoints by more than either one asked for. Directions blend
  // monotonically from one aim to the next.
  let a = KEYFRAMES[i]
  let b = KEYFRAMES[i + 1]
  let weight = f
  if (glide.eased) {
    // One climb and one turn over the whole glide, from its first shot to its
    // last, eased by distance travelled.
    a = KEYFRAMES[glide.startIndex]
    b = KEYFRAMES[glide.endIndex]
    weight = THREE.MathUtils.smoothstep(target / lengths[lengths.length - 1], 0, 1)
    outPosition.y = THREE.MathUtils.lerp(a.position.y, b.position.y, weight)
  }
  glideAimA.subVectors(a.lookAt, a.position)
  glideAimB.subVectors(b.lookAt, b.position)
  const distance = THREE.MathUtils.lerp(glideAimA.length(), glideAimB.length(), weight)
  glideAimA.normalize().lerp(glideAimB.normalize(), weight).normalize()
  outLookAt.copy(outPosition).addScaledVector(glideAimA, distance)
  return true
}

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
/**
 * Evaluates the path into caller-supplied vectors, allocating nothing.
 *
 * The allocating form below is fine at module-init time but was being called
 * once per frame by `ScrollCameraRig`, where it cost five allocations a frame —
 * two `Vector3`s (or a `getPoint()` result, itself allocating), two arrays from
 * `toArray()`, and the returned object literal. At 120Hz that is roughly 600
 * short-lived objects a second feeding the collector, and GC pauses are exactly
 * the sort of intermittent hitch that reads as judder in continuous motion.
 *
 * The maths is untouched — same segment search, same `smoothstep`, same zone
 * tests, same curve. Only the destination changed.
 */
export function sampleCameraPathInto(progress, outPosition, outLookAt) {
  // The journey ends at the hero: nothing past it is sampled.
  const p = THREE.MathUtils.clamp(progress, 0, JOURNEY_END_T)

  // The two travelling moves are shaped once, over their whole length — see
  // `GLIDES`. Both use `smootherstep`, so the camera reaches the hero at zero
  // velocity AND zero acceleration.
  if (sampleGlideInto(p, outPosition, outLookAt)) return

  let i = 0
  while (i < KEYFRAMES.length - 2 && p > KEYFRAMES[i + 1].t) i += 1
  const a = KEYFRAMES[i]
  const b = KEYFRAMES[i + 1]
  const rawSegmentT = b.t === a.t ? 0 : (p - a.t) / (b.t - a.t)

  const inGlideZone = i >= GLIDE_ZONE_START_INDEX && i < GLIDE_ZONE_END_INDEX

  // Raw inside the glide (one continuous move, eased there), eased per segment
  // everywhere else (each keyframe is a beat to settle on).
  const segmentT = inGlideZone ? rawSegmentT : THREE.MathUtils.smoothstep(rawSegmentT, 0, 1)

  segmentPositionInto(i, segmentT, outPosition)
  outLookAt.lerpVectors(a.lookAt, b.lookAt, segmentT)
}

/**
 * Allocating convenience form, for callers that run once and keep the result.
 *
 * `CinematicExperience`'s `SEED_POSITION` retains what this returns, so it must
 * hand back objects it owns. That is precisely why the
 * per-frame path got its own function rather than this one being changed to
 * reuse a shared buffer: a shared buffer would have silently mutated those
 * module-level constants to whatever the last rendered frame happened to be.
 */
/**
 * Distance along the whole camera path, tabulated against progress over the
 * journey (0 to `JOURNEY_END_T`).
 *
 * `ScrollCameraRig` eases position in this space, and section flights pace
 * their path legs by it. Re-measured lazily after `setHeroAspect` moves the
 * hero keyframes. Linear between samples; the camera itself is always placed
 * with `sampleCameraPathInto`, so the table only paces a move and never bends
 * it.
 */
const PATH_ARC_SAMPLES = 2048
const pathArcLengths = new Float32Array(PATH_ARC_SAMPLES + 1)
const arcPointScratch = new THREE.Vector3()
const arcPreviousScratch = new THREE.Vector3()
const arcLookAtScratch = new THREE.Vector3()

function measurePathArc() {
  sampleCameraPathInto(0, arcPreviousScratch, arcLookAtScratch)
  let total = 0
  pathArcLengths[0] = 0
  for (let i = 1; i <= PATH_ARC_SAMPLES; i += 1) {
    sampleCameraPathInto((i / PATH_ARC_SAMPLES) * JOURNEY_END_T, arcPointScratch, arcLookAtScratch)
    total += arcPointScratch.distanceTo(arcPreviousScratch)
    arcPreviousScratch.copy(arcPointScratch)
    pathArcLengths[i] = total
  }
  pathArcStale = false
}

export function pathArcLengthAt(progress) {
  if (pathArcStale) measurePathArc()
  const x = (THREE.MathUtils.clamp(progress, 0, JOURNEY_END_T) / JOURNEY_END_T) * PATH_ARC_SAMPLES
  const i = Math.min(Math.floor(x), PATH_ARC_SAMPLES - 1)
  return THREE.MathUtils.lerp(pathArcLengths[i], pathArcLengths[i + 1], x - i)
}

export function pathProgressAtArcLength(length) {
  if (pathArcStale) measurePathArc()
  if (length <= 0) return 0
  if (length >= pathArcLengths[PATH_ARC_SAMPLES]) return JOURNEY_END_T
  let lo = 0
  let hi = PATH_ARC_SAMPLES
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (pathArcLengths[mid] <= length) lo = mid
    else hi = mid
  }
  const span = pathArcLengths[hi] - pathArcLengths[lo]
  return ((lo + (span > 0 ? (length - pathArcLengths[lo]) / span : 0)) / PATH_ARC_SAMPLES) * JOURNEY_END_T
}

/**
 * Where a section flight leaves the path to go around a section it is not
 * stopping at, and where it rejoins.
 *
 * The scroll journey runs close up past the film camera's lens and the
 * monitor's screen. A flight between sections further apart bridges those
 * close-ups instead: it leaves the path before the approach begins and picks
 * the route up again after it (see `sectionFlightRoute.js`).
 *
 * - Film: from 0.30 on the descent (about two metres out on the lens axis,
 *   before the dive) to the Film -> Digital hand-off point, 1.6m in front of
 *   both props.
 * - Digital: from that hand-off point to 0.69 on the approach to the hero,
 *   just past the gap between the film camera and the computer.
 *
 * Both bridges were measured against the props' geometry: the film bypass
 * keeps 0.8m, the digital bypass the same ~0.33m the Digital shot itself sits
 * from the computer, and the two joined into one bypass 0.5m.
 */
/**
 * Keyframes the path turns a hard corner at. The scroll journey stops on them
 * (each segment eases in and out), but a section flight passing through one at
 * speed would take the corner as a jolt, so it rounds it off instead.
 */
export const PATH_CORNERS = [HANDOFF_PULLBACK_T]

export const SECTION_BYPASSES = [
  { sectionT: FILM_FOCUS_T, fromT: 0.3, toT: HANDOFF_PULLBACK_T },
  { sectionT: MONITOR_SNAP_T, fromT: HANDOFF_PULLBACK_T, toT: 0.69 },
]

const samplePositionScratch = new THREE.Vector3()
const sampleLookAtScratch = new THREE.Vector3()

export function sampleCameraPath(progress) {
  sampleCameraPathInto(progress, samplePositionScratch, sampleLookAtScratch)
  return {
    position: samplePositionScratch.toArray(),
    lookAt: sampleLookAtScratch.toArray(),
  }
}
