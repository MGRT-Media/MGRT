import * as THREE from 'three'
import { LAST_STAGE, STAGES } from './stageBeats.js'
import { frameStageCamera } from './stageFraming.js'

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

const solvedFov = STAGES.map((stage) => stage.camera.fov)

/**
 * Re-solves the fitted stages for a viewport (`stageFraming.js`) and moves
 * their points on the camera and aim paths.
 *
 * Called by the camera rig when the aspect ratio changes, never per frame.
 */
export function frameStagesForAspect(aspect) {
  STAGES.forEach((stage, index) => {
    if (!stage.camera.fit) return
    solvedFov[index] = frameStageCamera(
      stage.camera,
      aspect,
      positionCurve.points[index],
      lookAtCurve.points[index],
    )
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
  return THREE.MathUtils.lerp(read(from), read(from + 1), clamped - from)
}

const readFov = (index) => solvedFov[index]

export function stageFovAt(progress) {
  return betweenStages(progress, readFov)
}

/**
 * A sampler for one light's level, e.g. `stageLightLevel('lettering')`. Built
 * once per light, at module scope, so nothing is allocated per frame.
 */
export function stageLightLevel(name) {
  const read = (index) => STAGES[index].lights[name]
  return (progress) => betweenStages(progress, read)
}
