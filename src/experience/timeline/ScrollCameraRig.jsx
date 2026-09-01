import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { scrollProgress, scrollLockWobble } from './ScrollTimelineProvider.jsx'
import { sampleCameraPath } from './cameraPath.js'
import { updateCameraLockState } from './cameraLockEvent.js'

// Position and lookAt are damped at the *same* rate — sharing one lambda
// keeps both converging in lockstep rather than one settling before the
// other (which read as a rotational micro-snap at the monitor lock in an
// earlier round). No roll/up-tilting here anymore: this round's request
// explicitly removed banking from the camera path (`cameraPath.js` always
// returns a fixed lookAt now, no rotation shifts to smooth), so the prior
// round's up-vector-tilt mechanism was removed rather than left as dead
// code parameterized to zero.
const POSITION_DAMP_LAMBDA = 3.5
const LOOKAT_DAMP_LAMBDA = 3.5

// How quickly an attempted-scroll wobble (ScrollTimelineProvider.jsx's
// Snap 2 hard lock, "Subtle Resistance Fallback") decays back toward 0
// once the visitor stops pushing against it — a spring release, not an
// instant snap-back.
const WOBBLE_DECAY_LAMBDA = 6

/**
 * Drives the camera from the scroll-derived target every frame, but never
 * snaps directly to it: `THREE.MathUtils.damp` (frame-rate independent,
 * exponential) eases the actual camera position/lookAt toward the target
 * each frame, so motion glides to rest instead of hard-stopping the
 * instant scroll input stops. Still a direct `camera.position`/`lookAt`
 * mutation inside `useFrame` — never a React state update — per
 * technical-architecture.md §7.
 */
export default function ScrollCameraRig() {
  // Seeded to the progress-0 keyframe so there's no startup glide-in from
  // an arbitrary default on mount — matches cameraPath.js's START_POSITION
  // and its now-constant lookAt exactly.
  const dampedPosition = useRef(new THREE.Vector3(-1.0, 1.6, 8))
  const dampedLookAt = useRef(new THREE.Vector3(...sampleCameraPath(0).lookAt))

  useFrame(({ camera }, delta) => {
    const { position: targetPosition, lookAt: targetLookAt } = sampleCameraPath(scrollProgress.value)

    const pos = dampedPosition.current
    pos.x = THREE.MathUtils.damp(pos.x, targetPosition[0], POSITION_DAMP_LAMBDA, delta)
    pos.y = THREE.MathUtils.damp(pos.y, targetPosition[1], POSITION_DAMP_LAMBDA, delta)
    pos.z = THREE.MathUtils.damp(pos.z, targetPosition[2], POSITION_DAMP_LAMBDA, delta)

    const look = dampedLookAt.current
    look.x = THREE.MathUtils.damp(look.x, targetLookAt[0], LOOKAT_DAMP_LAMBDA, delta)
    look.y = THREE.MathUtils.damp(look.y, targetLookAt[1], LOOKAT_DAMP_LAMBDA, delta)
    look.z = THREE.MathUtils.damp(look.z, targetLookAt[2], LOOKAT_DAMP_LAMBDA, delta)

    // Resistance wobble: decays toward 0 every frame regardless of
    // whether the lock is still active, so a released lock's residual
    // push finishes springing back rather than freezing mid-wobble.
    // Applied as a tiny pull along the camera's own view axis (position
    // <-> lookAt), not by perturbing the sampled path progress — keeps
    // this purely cosmetic and fully decoupled from the actual lock/
    // camera-path state.
    scrollLockWobble.value = THREE.MathUtils.damp(scrollLockWobble.value, 0, WOBBLE_DECAY_LAMBDA, delta)
    if (scrollLockWobble.value !== 0) {
      const viewAxis = pos.clone().sub(look)
      if (viewAxis.lengthSq() > 0) {
        viewAxis.normalize().multiplyScalar(scrollLockWobble.value)
        camera.position.copy(pos).add(viewAxis)
      } else {
        camera.position.copy(pos)
      }
    } else {
      camera.position.copy(pos)
    }
    camera.lookAt(look)

    // Fires cameraLockEvent.js's onCameraLock/onCameraUnlock listeners on
    // the raw scroll progress (not the damped position) — the "lock" is a
    // scroll-state concept (has the visitor scrolled all the way there),
    // not a "has the camera's glide physically finished settling" one.
    updateCameraLockState(scrollProgress.value)
  })

  return null
}
