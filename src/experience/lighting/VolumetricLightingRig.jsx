import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { createVolumetricLighting } from './volumetricLighting.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'

// Beam/dust approach dip: fully visible before progress 0.30, reduced to
// FADE_FLOOR by 0.42, then held there through the monitor lock. An earlier
// round faded this all the way to 0 to keep the additive cone mesh fully
// out of view near the approach — but that read as the atmosphere
// vanishing rather than settling, which is its own reported problem. A
// floor (not zero) keeps a subtle ambient glow/dust presence for the rest
// of the scroll, including the final monitor-filling shot, while still
// thinning the beam during the one window closest to the camera's path.
const FADE_START = 0.3
const FADE_END = 0.42
const FADE_FLOOR = 0.3

/**
 * Thin R3F adapter around the framework-agnostic lighting controller.
 * Mounts once, disposes on unmount. Geometry (the beam's truncated cone,
 * see `volumetricLighting.js`) is still what keeps the camera from ever
 * entering the beam volume; the `useFrame` fade below is a separate,
 * additional measure that thins the beam during the camera's approach,
 * direct-mutating the controller's material uniforms — never React state —
 * per technical-architecture.md §7.
 */
export default function VolumetricLightingRig() {
  const controller = useMemo(() => createVolumetricLighting(), [])

  useEffect(() => {
    controller.init()
    return () => controller.dispose()
  }, [controller])

  useFrame((state) => {
    const dip = THREE.MathUtils.smoothstep(scrollProgress.value, FADE_START, FADE_END)
    const fade = THREE.MathUtils.lerp(1, FADE_FLOOR, dip)
    controller.setApproachFade(fade)
    // R3F's own clock, not tied to scroll — the dust keeps drifting even
    // while the user is completely still.
    controller.setTime(state.clock.elapsedTime)
  })

  // dispose={null}: disposal is handled by controller.dispose() above; R3F's
  // own auto-dispose traversal doesn't expect imperatively-nested lights and
  // groups and errors on unmount without this.
  return <primitive object={controller.group} dispose={null} />
}
