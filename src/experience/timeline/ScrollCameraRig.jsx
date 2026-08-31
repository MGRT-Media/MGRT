import { useFrame } from '@react-three/fiber'
import { scrollProgress } from './ScrollTimelineProvider.jsx'
import { sampleCameraPath } from './cameraPath.js'

/**
 * Drives the camera directly from the GSAP-scrubbed `scrollProgress.value`
 * every frame — a direct `camera.position.set` / `camera.lookAt` mutation
 * inside `useFrame`, never a React state update, per
 * technical-architecture.md §7.
 */
export default function ScrollCameraRig() {
  useFrame(({ camera }) => {
    const { position, lookAt } = sampleCameraPath(scrollProgress.value)
    camera.position.set(position[0], position[1], position[2])
    camera.lookAt(lookAt[0], lookAt[1], lookAt[2])
  })

  return null
}
