import * as THREE from 'three'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'
import { CAMERA_ANCHOR } from '../film/CinemaCamera.jsx'
import { BEAM_CENTER } from '../digital/plinthAnchor.js'
import { PILLAR_RING_CENTER, PILLAR_RING_RADIUS } from '../Environment.jsx'
import { ESTABLISH_T, FILM_FOCUS_T, INTRO_ALIGN_T } from './filmActBeats.js'

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
// without needing an explicit pause. Looks toward `ORBIT_ENSEMBLE_LOOKAT`
// (reused, not duplicated — the same point that already frames both the
// Cinema Camera and Monitor together during the opening orbit) rather
// than staying on `LENS_LOOKAT`, so the retreat itself reads as
// "revealing the next destination," not just backing away from the last
// one.
//
// Vertical rise: the lens (`lensY`) sits noticeably lower than the
// monitor screen (`screenY`, ~0.36 units higher — the Monitor's own
// plinth+housing stack simply stands taller than the Cinema Camera's low
// quadrupod) — per explicit follow-up, this climb needs to read as one
// smooth, continuous rise across the WHOLE hand-off arc, not a flat
// pull-back followed by a late vertical "lift" concentrated into the
// final push. `HANDOFF_PULLBACK_POSITION`'s own Y is therefore lerped
// between `lensY` and `screenY` at the SAME fraction (`HANDOFF_PULLBACK_T_FRACTION`)
// the pull-back keyframe itself sits at in time — so the vertical ascent
// rate stays proportional to elapsed time across both segments instead of
// being back-loaded into the second one, and (since Y is just one
// component of the same 3D position the spline/per-segment-smoothstep
// easing already carries) the rise shares that exact same easing: no
// separate vertical-only animation, no linear stops, by construction.
const HANDOFF_PULLBACK_T_FRACTION = 0.15
const HANDOFF_PULLBACK_T = FILM_FOCUS_T + (1 - FILM_FOCUS_T) * HANDOFF_PULLBACK_T_FRACTION
const HANDOFF_PULLBACK_DISTANCE = 1.6
const HANDOFF_PULLBACK_POSITION = new THREE.Vector3(
  lensX + fwdX * HANDOFF_PULLBACK_DISTANCE,
  THREE.MathUtils.lerp(lensY, screenY, HANDOFF_PULLBACK_T_FRACTION),
  lensZ + fwdZ * HANDOFF_PULLBACK_DISTANCE,
)

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

const KEYFRAMES = [
  ...orbitKeyframes, // Antipodal start (t: 0) through the exterior alignment point (t: 0.12) — already on-axis and looking at the lens
  { t: 0.135, position: GATE_POSITION, lookAt: LENS_LOOKAT }, // Through the gate — radius pulls in from the orbit to the ring itself, same axis, same look direction
  { t: ESTABLISH_T, position: ESTABLISH_POSITION, lookAt: LENS_LOOKAT }, // Snap 1 — Studio Scene, a waypoint on the same straight corridor
  { t: APPROACH_T, position: APPROACH_POSITION, lookAt: LENS_LOOKAT }, // Approach
  { t: FILM_FOCUS_T, position: LENS_DIVE_POSITION, lookAt: LENS_LOOKAT }, // Snap 2 — Cinema Lens
  { t: HANDOFF_PULLBACK_T, position: HANDOFF_PULLBACK_POSITION, lookAt: ORBIT_ENSEMBLE_LOOKAT }, // Film -> Digital hand-off: quick pull-back
  { t: 1, position: MONITOR_ALIGNED_POSITION, lookAt: MONITOR_ALIGNED_LOOKAT }, // Snap 3 — Digital Monitor
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
// zone (the curved orbit itself) and after it (lens-dive -> hand-off
// pull-back -> monitor) still uses the spline — those ARE genuine
// directional changes, not a case the "no correction after entering" rule
// was ever about. `STRAIGHT_ZONE_END_INDEX` is computed, not a literal —
// appending the hand-off pull-back keyframe after `LENS_DIVE_POSITION`
// (rather than before it) left this arithmetic, and therefore the
// straight-line guarantee itself, untouched.
const STRAIGHT_ZONE_START_INDEX = ORBIT_POINT_COUNT - 1 // last orbit point's index
const STRAIGHT_ZONE_END_INDEX = STRAIGHT_ZONE_START_INDEX + 4 // LENS_DIVE_POSITION's index

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
