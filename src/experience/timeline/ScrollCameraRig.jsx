import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { scrollProgress } from './ScrollTimelineProvider.jsx'
import { sampleCameraPath } from './cameraPath.js'

// Damping half-life-ish factor for THREE.MathUtils.damp — higher is
// snappier, lower is smoother. 4 gives a soft, physical follow without
// feeling disconnected from the (already Lenis-smoothed) scroll input.
const DAMP_LAMBDA = 4

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
    pos.x = THREE.MathUtils.damp(pos.x, targetPosition[0], DAMP_LAMBDA, delta)
    pos.y = THREE.MathUtils.damp(pos.y, targetPosition[1], DAMP_LAMBDA, delta)
    pos.z = THREE.MathUtils.damp(pos.z, targetPosition[2], DAMP_LAMBDA, delta)

    const look = dampedLookAt.current
    look.x = THREE.MathUtils.damp(look.x, targetLookAt[0], DAMP_LAMBDA, delta)
    look.y = THREE.MathUtils.damp(look.y, targetLookAt[1], DAMP_LAMBDA, delta)
    look.z = THREE.MathUtils.damp(look.z, targetLookAt[2], DAMP_LAMBDA, delta)

    camera.position.copy(pos)
    camera.lookAt(look)
  })

  return null
}
