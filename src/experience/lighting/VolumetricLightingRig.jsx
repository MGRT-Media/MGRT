import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { createVolumetricLighting } from './volumetricLighting.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'

// Beam/dust approach dip — DISABLED (floor raised to 1, a no-op) per
// explicit request that the beam "stay visible and stable through the
// ENTIRE scroll trajectory." Two earlier rounds used this to thin the
// beam during the approach (first to 0, then to a 0.3 floor after that
// read as the atmosphere vanishing) to guard against a reported
// monitor-transition light glitch — but that glitch was never actually
// reproduced in this environment despite dedicated testing (§4H), so
// disabling the guard entirely now trades a hedge against an unconfirmed
// issue for the requested constant, stable presence. The mechanism
// itself (and the geometric beam truncation that keeps the camera from
// ever entering the beam volume, which is unrelated and unaffected) is
// left in place in case a real transition artifact does turn up later.
const FADE_START = 0.3
const FADE_END = 0.42
const FADE_FLOOR = 1

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
