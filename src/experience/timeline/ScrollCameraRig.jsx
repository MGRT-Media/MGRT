import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { scrollProgress } from './ScrollTimelineProvider.jsx'
import { sampleCameraPath } from './cameraPath.js'

// Position and lookAt are damped at the *same* rate. An earlier round used
// a faster position lambda than lookAt for an asynchronous "weighty dolly"
// lag, but that meant position could finish settling while lookAt was
// still catching up — read as a rotational micro-snap right at the
// monitor-locked endpoint, since both targets stop moving at the same
// moment (progress reaches 1) but arrived at rest at different times.
// Sharing one (lower, softer) lambda makes both converge in lockstep, and
// the lower value itself gives a longer coast to rest.
const POSITION_DAMP_LAMBDA = 3.5
const LOOKAT_DAMP_LAMBDA = 3.5

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
  // an arbitrary default on mount.
  const dampedPosition = useRef(new THREE.Vector3(0, 1.6, 9))
  const dampedLookAt = useRef(new THREE.Vector3(0, 1.6, -50))

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

    camera.position.copy(pos)
    camera.lookAt(look)
  })

  return null
}
