import * as THREE from 'three'
import { LAST_STAGE, OVERVIEW_FRAMING, STAGES } from './stageBeats.js'
import { TABLE } from './studioLayout.js'

/**
 * Reads the stage definitions at any point between stages.
 *
 * `progress` is in stage units: 0 is the first stage, 1 the second, and 2.5 is
 * halfway from the third to the fourth. Every function here is a pure function
 * of it, which is what makes the sequence reversible — scrolling back is the
 * same samples in the other order.
 */
function splineThrough(points) {
  // Centripetal: passes through every stage without the overshoot a uniform
  // Catmull-Rom spline shows between unevenly spaced points.
  return new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3().fromArray(point)),
    false,
    'centripetal',
  )
}

const positionCurve = splineThrough(STAGES.map((stage) => stage.camera.position))
const lookAtCurve = splineThrough(STAGES.map((stage) => stage.camera.lookAt))

// The corners of the table's bounding box, floor to tabletop.
const TABLE_CORNERS = [-1, 1].flatMap((x) =>
  [-1, 1].flatMap((z) =>
    [TABLE.height, 0].map((y) => new THREE.Vector3((x * TABLE.width) / 2, y, (z * TABLE.depth) / 2)),
  ),
)

const fitCamera = new THREE.PerspectiveCamera()
const fitTarget = new THREE.Vector3()
const fitDirection = new THREE.Vector3()
const fitCorner = new THREE.Vector3()

const fill = { width: 0, height: 0, centerY: 0 }

/** The fractions of the frame the table spans from `distance`, into `fill`. */
function measureTableFill(distance) {
  fitCamera.position.copy(fitTarget).addScaledVector(fitDirection, distance)
  fitCamera.lookAt(fitTarget)
  fitCamera.updateMatrixWorld()
  let left = Infinity
  let right = -Infinity
  let bottom = Infinity
  let top = -Infinity
  for (const corner of TABLE_CORNERS) {
    fitCorner.copy(corner).project(fitCamera)
    left = Math.min(left, fitCorner.x)
    right = Math.max(right, fitCorner.x)
    bottom = Math.min(bottom, fitCorner.y)
    top = Math.max(top, fitCorner.y)
  }
  // Projected coordinates run from -1 to 1 across the frame.
  fill.width = (right - left) / 2
  fill.height = (top - bottom) / 2
  fill.centerY = (top + bottom) / 2
}

const BISECTION_STEPS = 24

/** The nearest distance at which the table is inside both of its limits. */
function solveFitDistance({ tableWidthFill, maxHeightFill, minDistance, maxDistance }) {
  // The table only gets smaller as the camera backs away, so bisect.
  let near = minDistance
  let far = maxDistance
  for (let i = 0; i < BISECTION_STEPS; i += 1) {
    const middle = (near + far) / 2
    measureTableFill(middle)
    if (fill.width > tableWidthFill || fill.height > maxHeightFill) near = middle
    else far = middle
  }
  return (near + far) / 2
}

/** Moves the aim point up or down the table's height until it sits centred. */
function centreFitTarget(distance) {
  // Aiming higher lowers the table in the frame, so bisect on the aim height.
  let low = 0
  let high = TABLE.height
  for (let i = 0; i < BISECTION_STEPS; i += 1) {
    fitTarget.y = (low + high) / 2
    measureTableFill(distance)
    if (fill.centerY > 0) low = fitTarget.y
    else high = fitTarget.y
  }
}

// Distance and aim depend on each other; a few rounds settle both.
const FIT_ROUNDS = 4

/**
 * Re-solves the stages whose framing depends on the viewport (the overview —
 * see `OVERVIEW_FRAMING`) and moves their points on the camera and aim paths.
 *
 * Called by the camera rig when the aspect ratio changes, never per frame.
 */
export function frameStagesForAspect(aspect) {
  STAGES.forEach((stage, index) => {
    if (!stage.camera.fitTableWidth) return
    fitTarget.fromArray(stage.camera.lookAt)
    fitDirection.fromArray(stage.camera.position).sub(fitTarget).normalize()
    fitCamera.fov = stage.camera.fov
    fitCamera.aspect = aspect
    fitCamera.updateProjectionMatrix()

    let distance = OVERVIEW_FRAMING.maxDistance
    for (let round = 0; round < FIT_ROUNDS; round += 1) {
      distance = solveFitDistance(OVERVIEW_FRAMING)
      centreFitTarget(distance)
    }
    positionCurve.points[index].copy(fitTarget).addScaledVector(fitDirection, distance)
    lookAtCurve.points[index].copy(fitTarget)
  })
}

function clampToStages(progress) {
  return THREE.MathUtils.clamp(progress, 0, LAST_STAGE)
}

/**
 * The camera's position and aim, written into the two given vectors.
 *
 * `getPoint` rather than `getPointAt`: it gives every leg the same share of the
 * curve's parameter, so stage N sits at exactly N / LAST_STAGE however long
 * each leg is.
 */
export function sampleStageCameraInto(progress, outPosition, outLookAt) {
  const t = clampToStages(progress) / LAST_STAGE
  positionCurve.getPoint(t, outPosition)
  lookAtCurve.getPoint(t, outLookAt)
}

/** A per-stage number, interpolated linearly between the two nearest stages. */
function betweenStages(progress, read) {
  const clamped = clampToStages(progress)
  const from = Math.min(Math.floor(clamped), LAST_STAGE - 1)
  return THREE.MathUtils.lerp(read(STAGES[from]), read(STAGES[from + 1]), clamped - from)
}

const readFov = (stage) => stage.camera.fov

export function stageFovAt(progress) {
  return betweenStages(progress, readFov)
}

/**
 * A sampler for one light's level, e.g. `stageLightLevel('lettering')`. Built
 * once per light, at module scope, so nothing is allocated per frame.
 */
export function stageLightLevel(name) {
  const read = (stage) => stage.lights[name]
  return (progress) => betweenStages(progress, read)
}
