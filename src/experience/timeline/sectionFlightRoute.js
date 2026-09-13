import * as THREE from 'three'
import {
  HERO_T,
  SECTION_FLIGHT_EXTERIOR_SECONDS,
  SECTION_FLIGHT_MAX_SECONDS,
  SECTION_FLIGHT_MIN_SECONDS,
  SECTION_FLIGHT_PACE,
} from './filmActBeats.js'
import {
  PATH_CORNERS,
  SECTION_BYPASSES,
  pathArcLengthAt,
  pathProgressAtArcLength,
  sampleCameraPathInto,
} from './cameraPath.js'
import { isHeroCaptured, requestHeroCapture, setHeroFlightExterior } from './heroSequence.js'
import { setContentBlendWeight } from './contentProgress.js'

/**
 * A section flight: the camera's direct route from wherever it is to a section
 * picked in the side navigation.
 *
 * **The route.** It reuses the journey's own corridors — they are the ones
 * already cleared through the room's architecture — but never its close-ups
 * of sections it is not stopping at. Where the journey would dive to the film
 * camera's lens or the monitor's screen on the way somewhere else, the flight
 * leaves the path before that approach and bridges to where the route carries
 * on (`SECTION_BYPASSES`), with a curve that matches the path's direction at
 * both ends. Crossing between the room and the exterior still goes through
 * the hero pose: it is the only place the billboard stands in for the wall
 * invisibly, so a flight in or out of Campaigns stops there for the hand-over.
 *
 * **Timing.** Each move between stops is one ease — smootherstep over its
 * whole length — so the camera accelerates once and settles once however many
 * path spans and bridges it strings together. Durations are paced by length
 * and clamped, so near and far destinations take similar time.
 *
 * **Redirects.** A flight can start with the camera anywhere, moving: part way
 * through another flight, or easing along the path. The route is planned from
 * the nearest point on the journey, and the difference between the camera's
 * real pose and velocity and that point is blended out over the first part of
 * the move with a Hermite curve, so position, velocity and orientation all
 * carry on continuously.
 */

const UP = new THREE.Vector3(0, 1, 0)
const EPSILON = 1e-4
/** A path span shorter than this at either end of a bridge is folded into the bridge. */
const ABSORB_SPAN = 1.2
/** Bridge handle length, as a fraction of the distance it spans. */
const BRIDGE_HANDLE = 0.4
/** Distance used to read the path's direction at a junction. */
const TANGENT_PROBE = 0.05
/** How far either side of a path corner the fillet that rounds it begins. */
const CORNER_FILLET = 0.45
/**
 * The view direction is averaged along the route, over a window that grows with
 * the move's pace. The journey eases each keyframe's aim on its own, and a
 * bridge turns between the aims at its two ends; at a flight's pace both would
 * whip round and stop. Averaging over the distance the camera covers in about
 * `LOOK_SMOOTHING_SECONDS` spreads each turn along the route. The window
 * narrows to nothing at both ends of a move, so the compositions a flight
 * leaves and arrives on are exact.
 */
const LOOK_SMOOTHING_SECONDS = 0.3
const LOOK_SMOOTHING_MIN = 1
const LOOK_SMOOTHING_MAX = 4
const LOOK_SAMPLES = 7
/** Metres of route each radian of view rotation is worth when pacing a move — see `measurePace`. */
const TURN_COST = 6
/** Distance either side of a turn its cost is spread over. */
const TURN_COST_SPREAD = 2
/**
 * Velocity a redirect cannot carry along its new route (a sideways or reversing
 * component) is blended out instead; capped so that momentum cannot carry the
 * camera far off the route. The exterior is open space, so it keeps more.
 */
const MAX_CARRIED_SPEED_INTERIOR = 14
const MAX_CARRIED_SPEED_EXTERIOR = 30
/**
 * Peak deceleration while a redirect sheds the velocity it cannot carry. The
 * blend's Hermite curve peaks at four times speed over its duration, which
 * sets how long the blend lasts.
 */
const REDIRECT_PEAK_DECELERATION = 40
const MIN_REDIRECT_BLEND_SECONDS = 0.5
/** Steepest start a redirected move's ease may take — above 3 it would overshoot. */
const MAX_INITIAL_SLOPE = 2.5
const MAX_REDIRECT_BLEND_SECONDS = 1.4
/** A flight that has nowhere to travel but starts off the path still eases back onto it. */
const SETTLE_SECONDS = 0.8
/** The share of an interior move over which content fades from origin to destination. */
const CONTENT_FADE_START = 0.15
const CONTENT_FADE_END = 0.85
/** Give up waiting for the billboard capture after this long rather than hanging at the hero. */
const PORTAL_TIMEOUT_MS = 8000

const lookAtScratch = new THREE.Vector3()
const lookPositionScratch = new THREE.Vector3()
const lookDirectionScratch = new THREE.Vector3()
const averageDirectionScratch = new THREE.Vector3()
const pacePositionScratch = new THREE.Vector3()
const spinQuaternionScratch = new THREE.Quaternion()
const spinDeltaScratch = new THREE.Quaternion()
const spinAxisScratch = new THREE.Vector3()
const paceQuaternionScratch = new THREE.Quaternion()
const matrixScratch = new THREE.Matrix4()
const pointA = new THREE.Vector3()
const pointB = new THREE.Vector3()
const quaternionScratch = new THREE.Quaternion()

function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Cubic ease from slope `a` at the start to rest at the end. */
function easeFromSlope(t, a) {
  return a * t + (3 - 2 * a) * t * t + (a - 2) * t * t * t
}

function pathPoseInto(progress, outPosition, outQuaternion) {
  sampleCameraPathInto(progress, outPosition, lookAtScratch)
  matrixScratch.lookAt(outPosition, lookAtScratch, UP)
  outQuaternion.setFromRotationMatrix(matrixScratch)
}

/** Direction of travel along the path at `progress`, arriving there (`into`) or leaving it. */
function pathDirection(progress, travel, into) {
  const s = pathArcLengthAt(progress)
  const from = into ? s - travel * TANGENT_PROBE : s
  const to = into ? s : s + travel * TANGENT_PROBE
  sampleCameraPathInto(pathProgressAtArcLength(from), pointA, lookAtScratch)
  sampleCameraPathInto(pathProgressAtArcLength(to), pointB, lookAtScratch)
  return new THREE.Vector3().subVectors(pointB, pointA).normalize()
}

function pathLeg(fromT, toT) {
  const fromS = pathArcLengthAt(fromT)
  const toS = pathArcLengthAt(toT)
  return { kind: 'path', fromT, toT, fromS, toS, length: Math.abs(toS - fromS) }
}

function bridgeLeg(fromT, toT, travel, leavesPath, joinsPath) {
  const start = new THREE.Vector3()
  const end = new THREE.Vector3()
  const startQuaternion = new THREE.Quaternion()
  const endQuaternion = new THREE.Quaternion()
  pathPoseInto(fromT, start, startQuaternion)
  pathPoseInto(toT, end, endQuaternion)
  // Match the path where the bridge meets it: the direction the camera was
  // already travelling when it leaves a path span, or the path's own departure
  // when the bridge starts the move; likewise at the other end.
  const startDirection = pathDirection(fromT, travel, leavesPath)
  const endDirection = pathDirection(toT, travel, !joinsPath)
  const handle = start.distanceTo(end) * BRIDGE_HANDLE
  const curve = new THREE.CubicBezierCurve3(
    start,
    start.clone().addScaledVector(startDirection, handle),
    end.clone().addScaledVector(endDirection, -handle),
    end,
  )
  return { kind: 'bridge', fromT, toT, curve, length: curve.getLength(), startQuaternion, endQuaternion }
}

/** The legs of a move through the room from `originT` to `targetT`. */
function interiorLegs(originT, targetT) {
  const travel = Math.sign(targetT - originT) || 1
  const lo = Math.min(originT, targetT)
  const hi = Math.max(originT, targetT)

  const cuts = SECTION_BYPASSES.filter((b) => b.sectionT > lo + EPSILON && b.sectionT < hi - EPSILON)
    .map((b) => ({ lo: Math.max(b.fromT, lo), hi: Math.min(b.toT, hi) }))
    .sort((a, b) => a.lo - b.lo)
    .reduce((merged, cut) => {
      const last = merged[merged.length - 1]
      if (last && cut.lo <= last.hi + EPSILON) last.hi = Math.max(last.hi, cut.hi)
      else merged.push({ ...cut })
      return merged
    }, [])
  if (travel < 0) cuts.reverse()

  // Stops along the direction of travel: path span, bridge, path span, ...
  const stops = [originT]
  for (const cut of cuts) stops.push(travel > 0 ? cut.lo : cut.hi, travel > 0 ? cut.hi : cut.lo)
  stops.push(targetT)

  const spans = []
  for (let i = 0; i < stops.length - 1; i += 1) {
    spans.push({ fromT: stops[i], toT: stops[i + 1], bridge: i % 2 === 1 })
  }
  // Fold a short path span at either end into its bridge: a few metres of the
  // journey's own close-up approach are not worth the extra turn.
  if (spans.length > 1 && !spans[0].bridge && pathLeg(spans[0].fromT, spans[0].toT).length < ABSORB_SPAN) {
    spans[1].fromT = spans[0].fromT
    spans.shift()
  }
  const last = spans.length - 1
  if (spans.length > 1 && !spans[last].bridge && pathLeg(spans[last].fromT, spans[last].toT).length < ABSORB_SPAN) {
    spans[last - 1].toT = spans[last].toT
    spans.pop()
  }

  // Round off any hard corner a path span would carry the camera through.
  const rounded = spans.flatMap((span) => {
    if (span.bridge) return [span]
    const spanLo = Math.min(span.fromT, span.toT)
    const spanHi = Math.max(span.fromT, span.toT)
    const corner = PATH_CORNERS.find((c) => c > spanLo + EPSILON && c < spanHi - EPSILON)
    if (corner === undefined) return [span]
    const cornerS = pathArcLengthAt(corner)
    const fromS = pathArcLengthAt(span.fromT)
    const toS = pathArcLengthAt(span.toT)
    const intoT = pathProgressAtArcLength(travel > 0 ? Math.max(cornerS - CORNER_FILLET, fromS) : Math.min(cornerS + CORNER_FILLET, fromS))
    const outT = pathProgressAtArcLength(travel > 0 ? Math.min(cornerS + CORNER_FILLET, toS) : Math.max(cornerS - CORNER_FILLET, toS))
    return [
      { fromT: span.fromT, toT: intoT, bridge: false },
      { fromT: intoT, toT: outT, bridge: true },
      { fromT: outT, toT: span.toT, bridge: false },
    ]
  })

  const legs = rounded
    .filter((span) => span.bridge || Math.abs(span.toT - span.fromT) > EPSILON)
    .map((span, i, all) =>
      span.bridge
        ? bridgeLeg(span.fromT, span.toT, travel, i > 0, i < all.length - 1)
        : pathLeg(span.fromT, span.toT),
    )
  // Already there: a zero-length leg still places the camera on the composition.
  return legs.length > 0 ? legs : [pathLeg(originT, targetT)]
}

function move(legs, exterior, weightFrom, weightTo, fixedSeconds) {
  const length = legs.reduce((sum, leg) => sum + leg.length, 0)
  const travelSeconds = THREE.MathUtils.clamp(length / SECTION_FLIGHT_PACE, SECTION_FLIGHT_MIN_SECONDS, SECTION_FLIGHT_MAX_SECONDS)
  const lookWindow = THREE.MathUtils.clamp(
    (length / (fixedSeconds ?? travelSeconds)) * LOOK_SMOOTHING_SECONDS,
    LOOK_SMOOTHING_MIN,
    LOOK_SMOOTHING_MAX,
  )
  const result = { legs, exterior, weightFrom, weightTo, length, lookWindow }
  measurePace(result)
  const seconds =
    fixedSeconds ??
    THREE.MathUtils.clamp(result.paceTotal / SECTION_FLIGHT_PACE, SECTION_FLIGHT_MIN_SECONDS, SECTION_FLIGHT_MAX_SECONDS)
  result.durationMs = seconds * 1000
  return result
}

/**
 * Paces a move by distance AND turning.
 *
 * Eased by distance alone, the camera kept its speed through the parts of a
 * route where the view swings round — the orbit's last stretch turns the view
 * a hundred degrees in a few metres — so those turns whipped past. Each radian
 * the view turns counts as `TURN_COST` metres of route instead, so the camera
 * slows where it turns and cruises where it does not, and the move's duration
 * accounts for both.
 */
function measurePace(activeMove) {
  const samples = THREE.MathUtils.clamp(Math.ceil(activeMove.length / 0.1), 16, 600)
  const step = activeMove.length / samples
  const distances = new Float32Array(samples + 1)
  const turns = new Float32Array(samples + 1)
  let previous = null
  for (let i = 0; i <= samples; i += 1) {
    distances[i] = step * i
    sampleMove(activeMove, distances[i], pacePositionScratch, paceQuaternionScratch)
    if (previous) {
      turns[i] = previous.angleTo(paceQuaternionScratch)
      previous.copy(paceQuaternionScratch)
    } else {
      previous = paceQuaternionScratch.clone()
    }
  }
  // Spread each turn's cost over the route either side of it, so the camera
  // eases off before a turn and picks up after it rather than braking at it.
  const reach = step > 0 ? Math.round(TURN_COST_SPREAD / step) : 0
  const measure = new Float32Array(samples + 1)
  let total = 0
  let windowSum = 0
  for (let i = 0; i <= Math.min(reach, samples); i += 1) windowSum += turns[i]
  for (let i = 1; i <= samples; i += 1) {
    if (i + reach <= samples) windowSum += turns[i + reach]
    if (i - reach - 1 >= 0) windowSum -= turns[i - reach - 1]
    const count = Math.min(i + reach, samples) - Math.max(i - reach, 0) + 1
    total += step + TURN_COST * (windowSum / count)
    measure[i] = total
  }
  activeMove.paceDistances = distances
  activeMove.paceMeasure = measure
  activeMove.paceTotal = total
}

/** Distance along a move at eased pace fraction `u`. */
function distanceAtPace(activeMove, u) {
  const { paceDistances, paceMeasure, paceTotal } = activeMove
  if (paceTotal <= EPSILON) return activeMove.length * u
  const target = u * paceTotal
  let lo = 0
  let hi = paceMeasure.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (paceMeasure[mid] <= target) lo = mid
    else hi = mid
  }
  const span = paceMeasure[hi] - paceMeasure[lo]
  return THREE.MathUtils.lerp(paceDistances[lo], paceDistances[hi], span > 0 ? (target - paceMeasure[lo]) / span : 0)
}

/**
 * Position and raw view direction at distance `distance` along a move; returns
 * the nominal journey progress there.
 */
function sampleMoveRaw(activeMove, distance, outPosition, outDirection) {
  let remaining = THREE.MathUtils.clamp(distance, 0, activeMove.length)
  for (let i = 0; i < activeMove.legs.length; i += 1) {
    const leg = activeMove.legs[i]
    const lastLeg = i === activeMove.legs.length - 1
    if (remaining > leg.length && !lastLeg) {
      remaining -= leg.length
      continue
    }
    const f = leg.length > 0 ? THREE.MathUtils.clamp(remaining / leg.length, 0, 1) : 1
    if (leg.kind === 'path') {
      // Exact at the ends: the distance table cannot tell apart points where
      // only the aim changes, and the ends are the compositions that matter.
      const progress =
        f <= 0 ? leg.fromT : f >= 1 ? leg.toT : pathProgressAtArcLength(THREE.MathUtils.lerp(leg.fromS, leg.toS, f))
      sampleCameraPathInto(progress, outPosition, lookAtScratch)
      outDirection.subVectors(lookAtScratch, outPosition).normalize()
      return progress
    }
    leg.curve.getPointAt(f, outPosition)
    quaternionScratch.slerpQuaternions(leg.startQuaternion, leg.endQuaternion, THREE.MathUtils.smoothstep(f, 0, 1))
    outDirection.set(0, 0, -1).applyQuaternion(quaternionScratch)
    // Off the path: report the junction the camera is nearer, never a progress
    // inside the section being bypassed.
    return f < 0.5 ? leg.fromT : leg.toT
  }
  return 0
}

/** Pose at distance `distance` along a move, aim averaged — see `LOOK_SMOOTHING_SECONDS`. */
function sampleMove(activeMove, distance, outPosition, outQuaternion) {
  const progress = sampleMoveRaw(activeMove, distance, outPosition, lookDirectionScratch)
  const window = Math.min(activeMove.lookWindow, distance, activeMove.length - distance)
  if (window > EPSILON) {
    const centre = THREE.MathUtils.clamp(distance, 0, activeMove.length)
    for (let k = 0; k < LOOK_SAMPLES; k += 1) {
      if (k === (LOOK_SAMPLES - 1) / 2) continue
      const offset = ((k / (LOOK_SAMPLES - 1)) * 2 - 1) * window
      sampleMoveRaw(activeMove, centre + offset, lookPositionScratch, averageDirectionScratch)
      lookDirectionScratch.add(averageDirectionScratch)
    }
    lookDirectionScratch.normalize()
  }
  lookAtScratch.copy(outPosition).add(lookDirectionScratch)
  matrixScratch.lookAt(outPosition, lookAtScratch, UP)
  outQuaternion.setFromRotationMatrix(matrixScratch)
  return progress
}

/**
 * Plans a flight to `targetT`.
 *
 * `originT` is the journey progress nearest the camera and `originExterior`
 * whether the exterior is showing. `position`/`quaternion`/`velocity` are the
 * camera's real current state, blended out at the start.
 */
export function createSectionFlight({
  originT,
  originExterior,
  targetT,
  position,
  quaternion,
  velocity,
  angularVelocity,
  immediate,
  now,
}) {
  const targetExterior = targetT >= 1 - EPSILON
  const moves = []
  if (originExterior) {
    const exteriorFrom = Math.max(originT, HERO_T)
    if (targetExterior) {
      moves.push(move([pathLeg(exteriorFrom, 1)], true, 0, 1, SECTION_FLIGHT_EXTERIOR_SECONDS * ((1 - exteriorFrom) / (1 - HERO_T))))
    } else {
      moves.push(move([pathLeg(exteriorFrom, HERO_T)], true, 0, 0, SECTION_FLIGHT_EXTERIOR_SECONDS * ((exteriorFrom - HERO_T) / (1 - HERO_T))))
      moves.push(move(interiorLegs(HERO_T, targetT), false, 0, 1))
    }
  } else {
    const interiorFrom = Math.min(originT, HERO_T)
    if (targetExterior) {
      moves.push(move(interiorLegs(interiorFrom, HERO_T), false, 0, 1))
      moves.push(move([pathLeg(HERO_T, 1)], true, 1, 1, SECTION_FLIGHT_EXTERIOR_SECONDS))
    } else {
      moves.push(move(interiorLegs(interiorFrom, targetT), false, 0, 1))
    }
  }
  if (immediate) moves.forEach((m) => (m.durationMs = 0))

  const flight = {
    targetT,
    targetExterior,
    moves,
    moveIndex: 0,
    moveStartedAt: now,
    exterior: originExterior,
    progress: originT,
    portal: null,
    // The camera's real state at the start, blended out over `redirectMs`.
    offset: new THREE.Vector3(),
    carriedVelocity: new THREE.Vector3(),
    startQuaternion: quaternion.clone(),
    // World-space axis times radians per second, carried like velocity.
    carriedAngularVelocity: angularVelocity ? angularVelocity.clone() : new THREE.Vector3(),
    redirectMs: 0,
    // Speed already heading along the new route becomes the first ease's
    // starting slope rather than something to blend away.
    initialSlope: 0,
  }

  const firstMove = moves[0]
  const routeStart = new THREE.Vector3()
  sampleMove(firstMove, 0, routeStart, quaternionScratch)
  flight.offset.subVectors(position, routeStart)
  const offRoute = flight.offset.length() > 0.005 || quaternionScratch.angleTo(quaternion) > 0.002
  if (immediate) return flight

  if (firstMove.length > EPSILON && firstMove.durationMs > 0 && velocity.lengthSq() > 1e-4) {
    const ahead = new THREE.Vector3()
    sampleMove(firstMove, Math.min(TANGENT_PROBE, firstMove.length), ahead, quaternionScratch)
    const routeDirection = ahead.sub(routeStart).normalize()
    const along = Math.max(0, velocity.dot(routeDirection))
    const { paceDistances, paceMeasure, paceTotal } = firstMove
    const distancePerMeasure = (paceDistances[1] - paceDistances[0]) / Math.max(paceMeasure[1] - paceMeasure[0], EPSILON)
    flight.initialSlope = THREE.MathUtils.clamp(
      (along * (firstMove.durationMs / 1000)) / Math.max(paceTotal * distancePerMeasure, EPSILON),
      0,
      MAX_INITIAL_SLOPE,
    )
    const carried = (flight.initialSlope * paceTotal * distancePerMeasure) / (firstMove.durationMs / 1000)
    flight.carriedVelocity
      .copy(velocity)
      .addScaledVector(routeDirection, -carried)
      .clampLength(0, firstMove.exterior ? MAX_CARRIED_SPEED_EXTERIOR : MAX_CARRIED_SPEED_INTERIOR)
  } else {
    flight.carriedVelocity.copy(velocity).clampLength(0, originExterior ? MAX_CARRIED_SPEED_EXTERIOR : MAX_CARRIED_SPEED_INTERIOR)
  }

  if (offRoute || flight.carriedVelocity.lengthSq() > 1e-4 || flight.carriedAngularVelocity.lengthSq() > 1e-4) {
    if (firstMove.length < EPSILON) firstMove.durationMs = Math.max(firstMove.durationMs, SETTLE_SECONDS * 1000)
    const blendSeconds = THREE.MathUtils.clamp(
      (4 * flight.carriedVelocity.length()) / REDIRECT_PEAK_DECELERATION,
      MIN_REDIRECT_BLEND_SECONDS,
      MAX_REDIRECT_BLEND_SECONDS,
    )
    // The blend has to finish inside the first move, so a short move stretches
    // to fit it rather than cutting the deceleration short.
    firstMove.durationMs = Math.max(firstMove.durationMs, (blendSeconds * 1000) / 0.6)
    flight.redirectMs = blendSeconds * 1000
  }
  return flight
}

/**
 * Advances the flight to `now` and writes the camera pose. Returns true on the
 * frame it arrives, with the pose exactly the destination's composition.
 */
export function stepSectionFlight(flight, now, aspect, outPosition, outQuaternion) {
  for (;;) {
    const activeMove = flight.moves[flight.moveIndex]

    if (flight.portal) {
      // Parked on the hero pose, waiting for the billboard to hold the frame it
      // is about to stand in for.
      sampleMove(activeMove, 0, outPosition, outQuaternion)
      const ready = isHeroCaptured(aspect) && flight.portal.frames >= 2
      if (!ready && now - flight.portal.startedAt < PORTAL_TIMEOUT_MS) {
        flight.portal.frames += 1
        return false
      }
      setHeroFlightExterior(true)
      flight.exterior = true
      flight.portal = null
      flight.moveStartedAt = now
    }

    const elapsed = now - flight.moveStartedAt
    const t = activeMove.durationMs > 0 ? THREE.MathUtils.clamp(elapsed / activeMove.durationMs, 0, 1) : 1
    const eased = flight.moveIndex === 0 && flight.initialSlope > 0 ? easeFromSlope(t, flight.initialSlope) : smootherstep(t)
    flight.progress = sampleMove(activeMove, distanceAtPace(activeMove, eased), outPosition, outQuaternion)

    const fade =
      activeMove.length > EPSILON && !activeMove.exterior
        ? THREE.MathUtils.smoothstep(eased, CONTENT_FADE_START, CONTENT_FADE_END)
        : eased
    setContentBlendWeight(THREE.MathUtils.lerp(activeMove.weightFrom, activeMove.weightTo, fade))

    if (flight.moveIndex === 0 && flight.redirectMs > 0 && elapsed < flight.redirectMs) {
      // Hermite blend out of the camera's starting state: the full offset and
      // its velocity at the start, nothing of either at the end.
      const u = elapsed / flight.redirectMs
      const h00 = 2 * u * u * u - 3 * u * u + 1
      const h10 = u * u * u - 2 * u * u + u
      const blendSeconds = flight.redirectMs / 1000
      outPosition.addScaledVector(flight.offset, h00).addScaledVector(flight.carriedVelocity, h10 * blendSeconds)
      // The starting orientation keeps turning the way it was, fading out on
      // the same curve, so rotation carries on too instead of freezing.
      const spin = flight.carriedAngularVelocity.length()
      spinQuaternionScratch.copy(flight.startQuaternion)
      if (spin > EPSILON) {
        spinAxisScratch.copy(flight.carriedAngularVelocity).divideScalar(spin)
        spinDeltaScratch.setFromAxisAngle(spinAxisScratch, spin * h10 * blendSeconds)
        spinQuaternionScratch.premultiply(spinDeltaScratch)
      }
      outQuaternion.slerpQuaternions(spinQuaternionScratch, quaternionScratch.copy(outQuaternion), THREE.MathUtils.smoothstep(u, 0, 1))
    }

    if (t < 1) return false

    // This move is done: arrive, or cross to the next one.
    if (flight.moveIndex === flight.moves.length - 1) return true
    flight.moveIndex += 1
    flight.moveStartedAt = now
    const nextMove = flight.moves[flight.moveIndex]
    if (nextMove.exterior && !flight.exterior) {
      requestHeroCapture()
      flight.portal = { startedAt: now, frames: 0 }
    } else if (!nextMove.exterior && flight.exterior) {
      setHeroFlightExterior(false)
      flight.exterior = false
    }
  }
}
