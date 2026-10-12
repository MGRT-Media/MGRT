import * as THREE from 'three'
import { FRAMING, PORTRAIT_ASPECT } from './stageBeats.js'
import { ROOM } from './studioLayout.js'

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
const corners = Array.from({ length: 8 }, () => new THREE.Vector3())

// What the subject occupies in the frame from the last `measure` call.
const span = { width: 0, height: 0, centerX: 0, centerY: 0 }

function setCorners({ center, size }) {
  let i = 0
  for (const x of [-0.5, 0.5]) {
    for (const y of [-0.5, 0.5]) {
      for (const z of [-0.5, 0.5]) {
        corners[i].set(center[0] + x * size[0], center[1] + y * size[1], center[2] + z * size[2])
        i += 1
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
  const { fit, lookAt, fov: baseFov } = stageCamera
  const from =
    aspect < PORTRAIT_ASPECT && stageCamera.portraitPosition ? stageCamera.portraitPosition : stageCamera.position
  const widthFill = fit.widthFill ?? FRAMING.widthFill
  const heightFill = fit.heightFill ?? FRAMING.heightFill

  target.fromArray(lookAt)
  direction.fromArray(from).sub(target).normalize()
  setCorners(fit.bounds)
  camera.aspect = aspect

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
    target.addScaledVector(up, span.centerY * halfHeight)
  }

  outPosition.copy(target).addScaledVector(direction, distance)
  outLookAt.copy(target)
  return fov
}
