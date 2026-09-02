import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { scrollProgress, scrollLockWobble } from './ScrollTimelineProvider.jsx'
import { sampleCameraPath } from './cameraPath.js'

// Lowered from 3.5 (both were previously equal) per explicit request to
// give the camera more perceived "weight and inertia" as it settles, and
// to stop position/rotation from converging in perfect lockstep. Position
// is intentionally the heavier (slower/lower) of the two, so the camera
// keeps gliding to its resting spot for a beat after it's already
// finished turning to face it, rather than both stopping on the same
// frame.
const POSITION_DAMP_LAMBDA = 2.6
const ROTATION_DAMP_LAMBDA = 3.0

// How quickly an attempted-scroll wobble (ScrollTimelineProvider.jsx's
// Snap 2 hard lock, "Subtle Resistance Fallback") decays back toward 0
// once the visitor stops pushing against it — a spring release, not an
// instant snap-back.
const WOBBLE_DECAY_LAMBDA = 6

// Reused across frames rather than allocated fresh each tick — pure
// scratch space, never read from outside this module.
const scratchMatrix = new THREE.Matrix4()
const targetQuaternionScratch = new THREE.Quaternion()
const lookAtScratch = new THREE.Vector3()
const forwardScratch = new THREE.Vector3()

function computeTargetQuaternion(outQuaternion, eye, lookAtPoint, up) {
  scratchMatrix.lookAt(eye, lookAtPoint, up)
  return outQuaternion.setFromRotationMatrix(scratchMatrix)
}

/**
 * Drives the camera from the scroll-derived target every frame, but never
 * snaps directly to it. Position: `THREE.MathUtils.damp` (frame-rate
 * independent exponential) per axis, as before. Rotation: no longer a
 * damped lookAt *point* fed through `camera.lookAt()` every frame — per
 * explicit request that turning to face the lens "felt robotically
 * hinged... like a sharp pivot on a rigid axis" rather than a fluid arc.
 * Damping a 3D point and re-deriving a lookAt matrix from it each frame
 * doesn't interpolate *rotation* at a constant rate; for a large turn
 * (e.g. dolly-in while also swinging from the establish framing to the
 * lens) the apparent angular speed can vary in a way that reads as
 * hinged rather than swept. Real spherical interpolation needs to happen
 * in rotation-space, so this now derives a target orientation
 * (`computeTargetQuaternion`, a look-at matrix converted to a quaternion)
 * and `Quaternion.slerp`s the camera's actual orientation toward it every
 * frame — genuine constant-angular-velocity rotation, independent of how
 * far the lookAt point itself is from the camera. Still a direct
 * `camera.position`/`camera.quaternion` mutation inside `useFrame` —
 * never a React state update — per technical-architecture.md §7.
 */
export default function ScrollCameraRig() {
  // Seeded to the progress-0 keyframe so there's no startup glide-in from
  // an arbitrary default on mount — matches cameraPath.js's START_POSITION
  // and its initial lookAt exactly.
  const dampedPosition = useRef(new THREE.Vector3(-1.0, 1.6, 8))
  const dampedQuaternion = useRef(
    computeTargetQuaternion(
      new THREE.Quaternion(),
      dampedPosition.current,
      new THREE.Vector3(...sampleCameraPath(0).lookAt),
      new THREE.Vector3(0, 1, 0),
    ),
  )

  useFrame(({ camera }, delta) => {
    const { position: targetPosition, lookAt: targetLookAt } = sampleCameraPath(scrollProgress.value)

    const pos = dampedPosition.current
    pos.x = THREE.MathUtils.damp(pos.x, targetPosition[0], POSITION_DAMP_LAMBDA, delta)
    pos.y = THREE.MathUtils.damp(pos.y, targetPosition[1], POSITION_DAMP_LAMBDA, delta)
    pos.z = THREE.MathUtils.damp(pos.z, targetPosition[2], POSITION_DAMP_LAMBDA, delta)

    const targetQuaternion = computeTargetQuaternion(
      targetQuaternionScratch,
      pos,
      lookAtScratch.set(targetLookAt[0], targetLookAt[1], targetLookAt[2]),
      camera.up,
    )
    // Frame-rate-independent slerp factor with the same exponential shape
    // as THREE.MathUtils.damp, so rotation and position share one
    // consistent "catch-up" feel despite using different lambdas/math.
    const rotationAlpha = 1 - Math.exp(-ROTATION_DAMP_LAMBDA * delta)
    dampedQuaternion.current.slerp(targetQuaternion, rotationAlpha)
    camera.quaternion.copy(dampedQuaternion.current)

    // Resistance wobble: decays toward 0 every frame regardless of
    // whether the lock is still active, so a released lock's residual
    // push finishes springing back rather than freezing mid-wobble.
    // Applied as a tiny pull backward along the camera's own (now
    // slerped) current view direction — purely cosmetic, decoupled from
    // the actual lock/camera-path state.
    scrollLockWobble.value = THREE.MathUtils.damp(scrollLockWobble.value, 0, WOBBLE_DECAY_LAMBDA, delta)
    if (scrollLockWobble.value !== 0) {
      const forward = forwardScratch.set(0, 0, -1).applyQuaternion(camera.quaternion)
      camera.position.copy(pos).addScaledVector(forward, -scrollLockWobble.value)
    } else {
      camera.position.copy(pos)
    }
  })

  return null
}
