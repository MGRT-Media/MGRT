import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { scrollProgress, scrollLockWobble } from './ScrollTimelineProvider.jsx'
import { sampleCameraPath, sampleCameraPathInto, setHeroAspect } from './cameraPath.js'

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
const forwardScratch = new THREE.Vector3()
// Written by `sampleCameraPathInto` every frame — see its note on why the
// per-frame path does not use the allocating sampler.
const pathPositionScratch = new THREE.Vector3()
const pathLookAtScratch = new THREE.Vector3()

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
  // an arbitrary default on mount — reads `sampleCameraPath(0)` directly
  // rather than a copied literal, matching `CinematicExperience.jsx`'s own
  // `SEED_POSITION` (its `<Canvas camera position={...}>` prop). A prior
  // round's hardcoded `(-1.0, 1.6, 8)` fell out of sync with the real
  // progress-0 position after several later rounds changed the exterior
  // orbit's radius/height/room scale (§4BE, §4BK) without this literal
  // being updated — exactly the "visible jump/readjustment on load" bug
  // this was meant to prevent: on mount, the Canvas's own seed placed the
  // camera correctly, but this rig's *separate* `dampedPosition` ref still
  // started from the stale value, so the very first frames visibly damped
  // FROM the wrong position TO the correct one. Importing the function
  // instead of a copied number makes this class of drift impossible again.
  const dampedPosition = useRef(new THREE.Vector3(...sampleCameraPath(0).position))
  const dampedQuaternion = useRef(
    computeTargetQuaternion(
      new THREE.Quaternion(),
      dampedPosition.current,
      new THREE.Vector3(...sampleCameraPath(0).lookAt),
      new THREE.Vector3(0, 1, 0),
    ),
  )

  const heroAspect = useRef(0)

  useFrame(({ camera }, delta) => {
    // The MGRT hero frames the wordmark by WIDTH, so its stand-off depends on
    // the viewport's aspect — see `heroDistanceForAspect`. Recomputed only when
    // the aspect actually changes rather than every frame, since it walks the
    // wall's plan curve.
    if (camera.aspect !== heroAspect.current) {
      heroAspect.current = camera.aspect
      setHeroAspect(camera.aspect)
    }

    sampleCameraPathInto(scrollProgress.value, pathPositionScratch, pathLookAtScratch)

    const pos = dampedPosition.current
    pos.x = THREE.MathUtils.damp(pos.x, pathPositionScratch.x, POSITION_DAMP_LAMBDA, delta)
    pos.y = THREE.MathUtils.damp(pos.y, pathPositionScratch.y, POSITION_DAMP_LAMBDA, delta)
    pos.z = THREE.MathUtils.damp(pos.z, pathPositionScratch.z, POSITION_DAMP_LAMBDA, delta)

    // Orientation is derived from the path's OWN eye/target pair, not from
    // the damped eye — a real bug fix, not a refactor. Feeding the damped
    // `pos` here mixed position lag into the aim: the aim vector became
    // `(target - pos) = (targetLookAt - targetPosition) + (targetPosition -
    // pos)`, and that second term is the lag, which points along the
    // direction of travel and grows with speed. Any keyframe span whose
    // travel direction isn't parallel to its view direction therefore made
    // the camera YAW while moving and un-yaw as it settled — a
    // speed-proportional turn that no amount of keyframe tuning could
    // remove, and that `sampleCameraPath`'s own output can't reveal because
    // it only exists at runtime. Act 3 depends on this: its whole design is
    // a constant `lookAt - position` offset (see `cameraPath.js`'s
    // `CAMPAIGNS_FACING`), which is exactly the quantity this line was
    // corrupting. Rotation is still slerped toward the target, so the
    // damping feel is unchanged; only what it aims at is now lag-free.
    const targetQuaternion = computeTargetQuaternion(
      targetQuaternionScratch,
      pathPositionScratch,
      pathLookAtScratch,
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
