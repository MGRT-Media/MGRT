import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { cameraProgress, renderedProgress } from '../timeline/journeyProgress.js'
import { STAGE_TRAVEL_SECONDS } from './stageBeats.js'
import { frameStagesForAspect, sampleStageCameraInto, stageFovAt } from './stageSampling.js'

// Close enough to the requested stage, and slow enough, to call it arrived.
const REST_DISTANCE = 1e-4
const REST_SPEED = 1e-3

// A frame this long is a stall or a tab coming back, not motion to integrate.
const MAX_STEP_SECONDS = 0.1

const lookAtScratch = new THREE.Vector3()

/**
 * A critically damped spring toward `target`, the same follow the original
 * rig's damping gives but with a velocity of its own: the move starts from
 * rest instead of at full speed, and a new request made mid-move — including
 * one in the opposite direction — bends the motion rather than restarting it.
 *
 * Returns the new value and writes the new velocity into `state.velocity`.
 */
function springToward(current, target, state, smoothTime, delta) {
  const omega = 2 / smoothTime
  const x = omega * delta
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const offset = current - target
  const push = (state.velocity + omega * offset) * delta
  state.velocity = (state.velocity - omega * push) * decay
  return target + (offset + push) * decay
}

/**
 * Moves the camera to the requested stage.
 *
 * The only thing that is animated is one number, `cameraProgress`. Position,
 * aim and field of view are all read from the stage definitions at that
 * number (`stageSampling.js`), and the lights read the same number, so the
 * camera and the lighting cannot drift apart and reversing is exact.
 */
export default function StudioCameraRig() {
  const spring = useRef({ velocity: 0 })
  const reducedMotion = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const framedAspect = useRef(0)

  useFrame(({ camera, size }, delta) => {
    const aspect = size.width / size.height
    if (aspect !== framedAspect.current) {
      framedAspect.current = aspect
      frameStagesForAspect(aspect)
    }

    const target = renderedProgress.value
    let progress = cameraProgress.value

    if (reducedMotion.current) {
      progress = target
    } else if (progress !== target) {
      progress = springToward(progress, target, spring.current, STAGE_TRAVEL_SECONDS, Math.min(delta, MAX_STEP_SECONDS))
      if (Math.abs(target - progress) < REST_DISTANCE && Math.abs(spring.current.velocity) < REST_SPEED) {
        progress = target
        spring.current.velocity = 0
      }
    }
    cameraProgress.value = progress

    sampleStageCameraInto(progress, camera.position, lookAtScratch)
    camera.lookAt(lookAtScratch)

    const fov = stageFovAt(progress)
    if (Math.abs(camera.fov - fov) > 1e-4) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
