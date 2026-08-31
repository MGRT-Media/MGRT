import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { createVolumetricLighting } from './volumetricLighting.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'

// Beam/dust fade-out window: fully visible before progress 0.30, fully
// transparent by 0.42 — clear of the camera's approach into the monitor
// well before the final lock, so the additive cone mesh is never near the
// camera's view during that transition. See `setApproachFade` for why.
const FADE_START = 0.3
const FADE_END = 0.42

/**
 * Thin R3F adapter around the framework-agnostic lighting controller.
 * Mounts once, disposes on unmount. Geometry (the beam's truncated cone,
 * see `volumetricLighting.js`) is still what keeps the camera from ever
 * entering the beam volume; the `useFrame` fade below is a separate,
 * additional measure that keeps the beam out of the camera's view
 * entirely during the monitor approach, direct-mutating the controller's
 * material uniforms — never React state — per technical-architecture.md §7.
 */
export default function VolumetricLightingRig() {
  const controller = useMemo(() => createVolumetricLighting(), [])

  useEffect(() => {
    controller.init()
    return () => controller.dispose()
  }, [controller])

  useFrame(() => {
    const fade = 1 - THREE.MathUtils.smoothstep(scrollProgress.value, FADE_START, FADE_END)
    controller.setApproachFade(fade)
  })

  // dispose={null}: disposal is handled by controller.dispose() above; R3F's
  // own auto-dispose traversal doesn't expect imperatively-nested lights and
  // groups and errors on unmount without this.
  return <primitive object={controller.group} dispose={null} />
}
