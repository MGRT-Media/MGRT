import * as THREE from 'three'
import { FRAMING, PORTRAIT_ASPECT } from './stageBeats.js'
import { LIGHTS, ROOM } from './studioLayout.js'

/**
 * Solves a fitted stage's camera for a viewport: the same idea as CSS
 * `object-fit: contain`. The stage says what the shot must show and which way
 * it is viewed from; this finds where the camera stands so that all of it is
 * in frame, centred, at the size asked for — see `FRAMING` in `stageBeats.js`.
 *
 * Runs when the aspect ratio changes, never per frame.
 */
const BISECTION_STEPS = 22

// Distance, aim and field of view depend on one another; a few rounds settle
// all three.
const ROUNDS = 5

const camera = new THREE.PerspectiveCamera()
const target = new THREE.Vector3()
const direction = new THREE.Vector3()
const right = new THREE.Vector3()
const up = new THREE.Vector3()
const projected = new THREE.Vector3()
// The corners of everything the current shot has to show.
const corners = []

// What the subject occupies in the frame from the last `measure` call.
const span = { width: 0, height: 0, centerX: 0, centerY: 0 }

/** `bounds` is one box or a list of boxes framed together. */
function setCorners(bounds) {
  corners.length = 0
  for (const { center, size } of [bounds].flat()) {
    for (const x of [-0.5, 0.5]) {
      for (const y of [-0.5, 0.5]) {
        for (const z of [-0.5, 0.5]) {
          corners.push(new THREE.Vector3(center[0] + x * size[0], center[1] + y * size[1], center[2] + z * size[2]))
        }
      }
    }
  }
}

function measure(distance) {
  camera.position.copy(target).addScaledVector(direction, distance)
  camera.lookAt(target)
  camera.updateMatrixWorld()
  let left = Infinity
  let rightmost = -Infinity
  let bottom = Infinity
  let top = -Infinity
  for (const corner of corners) {
    projected.copy(corner).project(camera)
    left = Math.min(left, projected.x)
    rightmost = Math.max(rightmost, projected.x)
    bottom = Math.min(bottom, projected.y)
    top = Math.max(top, projected.y)
  }
  // Projected coordinates run from -1 to 1 across the frame.
  span.width = (rightmost - left) / 2
  span.height = (top - bottom) / 2
  span.centerX = (rightmost + left) / 2
  span.centerY = (top + bottom) / 2
}

// Points across the upper half of the frame, as projected coordinates. A level
// camera sees highest along its top edge, at the middle when it looks down the
// room and at the corners when it looks across one.
const UPPER_FRAME = [-1, -0.5, 0, 0.5, 1].flatMap((x) => [1, 0.5].map((y) => [x, y]))

const ray = new THREE.Vector3()

// Where the lights hang. Nothing is modelled there yet, but a fixture below
// the ceiling can be in frame when the ceiling itself is not.
const FIXTURES = [LIGHTS.lettering.position, LIGHTS.tableKey.position].map((position) =>
  new THREE.Vector3().fromArray(position),
)

/** How high up the room's shell the sight line through a frame point lands. */
function sightHeight(position, [x, y]) {
  ray.set(x, y, 0.5).unproject(camera).sub(position).normalize()
  // The first wall, floor or ceiling plane the ray reaches from inside the room.
  let reach = Infinity
  if (ray.x > 1e-6) reach = Math.min(reach, (ROOM.width / 2 - position.x) / ray.x)
  if (ray.x < -1e-6) reach = Math.min(reach, (-ROOM.width / 2 - position.x) / ray.x)
  if (ray.y > 1e-6) reach = Math.min(reach, (ROOM.height - position.y) / ray.y)
  if (ray.y < -1e-6) reach = Math.min(reach, -position.y / ray.y)
  if (ray.z > 1e-6) reach = Math.min(reach, (ROOM.frontWallZ - position.z) / ray.z)
  if (ray.z < -1e-6) reach = Math.min(reach, (ROOM.rearWallZ - position.z) / ray.z)
  return position.y + ray.y * reach
}

/**
 * Whether the ceiling, the line where it meets a wall, or a light fixture is
 * in the frame.
 */
function seesCeiling(position, lookAt, fov) {
  setFov(fov)
  camera.position.copy(position)
  camera.lookAt(lookAt)
  camera.updateMatrixWorld()
  const limit = ROOM.height - FRAMING.ceilingClearance
  for (const point of UPPER_FRAME) {
    if (sightHeight(position, point) > limit) return true
  }
  for (const fixture of FIXTURES) {
    projected.copy(fixture).project(camera)
    if (Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1) return true
  }
  return false
}

const loweredAim = new THREE.Vector3()

/**
 * Tilts a shot down, by lowering its aim, until the ceiling is out of frame.
 *
 * The top of every composition is meant to be wall. A shot that is authored or
 * solved clear of the ceiling is left exactly as it is; this only acts on one
 * that is not, and by no more than it needs.
 */
function keepCeilingOut(position, lookAt, fov) {
  if (!seesCeiling(position, lookAt, fov)) return
  let clear = ROOM.height
  let blocked = 0
  for (let i = 0; i < BISECTION_STEPS; i += 1) {
    const drop = (clear + blocked) / 2
    loweredAim.copy(lookAt).setY(lookAt.y - drop)
    if (seesCeiling(position, loweredAim, fov)) blocked = drop
    else clear = drop
  }
  lookAt.y -= clear
}

/**
 * The same guard for any point along the path, not only its resting stages:
 * between two shots that each clear the ceiling, the camera can still rise
 * faster than its aim falls. Called every frame by the sampler; it measures
 * with scratch objects and does nothing more unless the ceiling is in frame.
 */
export function keepCeilingOutOfShot(position, lookAt, fov, aspect) {
  camera.aspect = aspect
  keepCeilingOut(position, lookAt, fov)
}

/** How far along `direction` the camera can back away before leaving the room. */
function roomLimit() {
  const margin = FRAMING.roomMargin
  const low = [-ROOM.width / 2 + margin, margin, ROOM.rearWallZ + margin]
  const high = [ROOM.width / 2 - margin, ROOM.height - margin, ROOM.frontWallZ - margin]
  let limit = Infinity
  direction.toArray().forEach((component, axis) => {
    const origin = target.getComponent(axis)
    if (component > 1e-6) limit = Math.min(limit, (high[axis] - origin) / component)
    else if (component < -1e-6) limit = Math.min(limit, (low[axis] - origin) / component)
  })
  return Math.max(limit, FRAMING.minDistance)
}

function setFov(fov) {
  camera.fov = fov
  camera.updateProjectionMatrix()
}

/** The nearest distance at which the subject is no larger than asked for. */
function fitDistance(widthFill, heightFill, farthest) {
  // The subject only gets smaller as the camera backs away, so bisect.
  let near = FRAMING.minDistance
  let far = farthest
  for (let i = 0; i < BISECTION_STEPS; i += 1) {
    const middle = (near + far) / 2
    measure(middle)
    if (span.width > widthFill || span.height > heightFill) near = middle
    else far = middle
  }
  return far
}

/** The narrowest field of view, from `distance`, that holds the subject to its size. */
function fitFov(baseFov, distance, widthFill, heightFill) {
  const overflows = () => span.width > widthFill || span.height > heightFill
  setFov(baseFov)
  measure(distance)
  if (!overflows()) return baseFov
  let narrow = baseFov
  let wide = FRAMING.maxFov
  for (let i = 0; i < BISECTION_STEPS; i += 1) {
    const middle = (narrow + wide) / 2
    setFov(middle)
    measure(distance)
    if (overflows()) narrow = middle
    else wide = middle
  }
  return wide
}

/**
 * Writes the solved camera for `stageCamera` at `aspect` into `outPosition`
 * and `outLookAt`, and returns its field of view.
 */
export function frameStageCamera(stageCamera, aspect, outPosition, outLookAt) {
  const shot =
    aspect < PORTRAIT_ASPECT && stageCamera.portrait ? { ...stageCamera, ...stageCamera.portrait } : stageCamera
  const { fit, lookAt, fov: baseFov, position: from } = shot
  camera.aspect = aspect

  // A fixed shot is used as written.
  if (!fit) {
    outPosition.fromArray(from)
    outLookAt.fromArray(lookAt)
    keepCeilingOut(outPosition, outLookAt, baseFov)
    return baseFov
  }

  const widthFill = fit.widthFill ?? FRAMING.widthFill
  const heightFill = fit.heightFill ?? FRAMING.heightFill
  // Where the subject's middle sits up the frame: 0 is centred, -1 the bottom edge.
  const centerY = fit.centerY ?? 0

  target.fromArray(lookAt)
  direction.fromArray(from).sub(target).normalize()
  setCorners(fit.bounds)

  let distance = FRAMING.minDistance
  let fov = baseFov
  for (let round = 0; round < ROUNDS; round += 1) {
    setFov(baseFov)
    const farthest = roomLimit()
    distance = fitDistance(widthFill, heightFill, farthest)
    fov = fitFov(baseFov, distance, widthFill, heightFill)

    // Slide the aim across the view until the subject sits centred.
    measure(distance)
    const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(fov / 2))
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    up.setFromMatrixColumn(camera.matrixWorld, 1)
    target.addScaledVector(right, span.centerX * halfHeight * aspect)
    target.addScaledVector(up, (span.centerY - centerY) * halfHeight)
  }

  outPosition.copy(target).addScaledVector(direction, distance)
  outLookAt.copy(target)
  keepCeilingOut(outPosition, outLookAt, fov)
  return fov
}
