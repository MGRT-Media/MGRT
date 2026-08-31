import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { createVolumetricLighting } from './volumetricLighting.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'

// Dark-to-light ignition ramp — replaces the previous approach-fade
// mechanism (removed; it thinned the beam near the monitor, the opposite
// of what this round asks for). The room starts near-total darkness at
// progress 0 and ramps to full established brightness by progress 0.4,
// then holds there through the monitor lock — the camera's straight
// diagonal descent (cameraPath.js) is unaffected, this only ever touches
// light/opacity values, never position or orientation.
const IGNITE_START = 0
const IGNITE_END = 0.4

/**
 * Thin R3F adapter around the framework-agnostic lighting controller.
 * Mounts once, disposes on unmount. Geometry (the beam's truncated cone,
 * see `volumetricLighting.js`) still keeps the camera from ever entering
 * the beam volume, independent of intensity; the `useFrame` ignition ramp
 * below is a separate, additional measure driving the dramatic reveal,
 * direct-mutating the controller's light/material properties — never
 * React state — per technical-architecture.md §7.
 */
export default function VolumetricLightingRig() {
  const controller = useMemo(() => createVolumetricLighting(), [])

  useEffect(() => {
    controller.init()
    return () => controller.dispose()
  }, [controller])

  useFrame((state) => {
    const ignite = THREE.MathUtils.smoothstep(scrollProgress.value, IGNITE_START, IGNITE_END)
    controller.setIgnition(ignite)
    // R3F's own clock, not tied to scroll — the dust keeps drifting even
    // while the user is completely still.
    controller.setTime(state.clock.elapsedTime)
  })

  // dispose={null}: disposal is handled by controller.dispose() above; R3F's
  // own auto-dispose traversal doesn't expect imperatively-nested lights and
  // groups and errors on unmount without this.
  return <primitive object={controller.group} dispose={null} />
}
