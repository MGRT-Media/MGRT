import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { createVolumetricLighting } from './volumetricLighting.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'

// Dark-to-light ignition ramp — replaces the previous approach-fade
// mechanism (removed; it thinned the beam near the monitor, the opposite
// of what this round asks for). The room starts near-total darkness at
// progress 0 and ramps to full established brightness, then holds there
// through the rest of the sequence — this only ever touches light/opacity
// values, never camera position or orientation. One single continuous
// curve, keyed to `scrollProgress.value` the exact same way the camera
// path itself is — there is no separate "Intro lighting" vs. "Film
// lighting" state to desync from the camera; it's one physical light
// source the whole way through, by construction.
//
// IGNITE_END re-derived again, 0.063 -> 0.06, to track cameraPath.js's
// latest wide-half-circle redesign: the request dropped the clock-face
// vocabulary entirely in favor of "by approximately the midpoint of the
// half-circle, the room should be fully readable." The orbit body still
// spans t: 0 -> 0.12 (`ORBIT_BODY_T_END`), so its literal midpoint is
// 0.06 — simpler and more precise than re-solving a named clock position
// against the ring's geometry, now that there isn't one. Still one single
// continuous curve holding flat at full brightness for the rest of the
// orbit, the gate, Establish, Approach, and Film, per explicit "maintain
// the established lighting... no reset of the atmosphere." `smoothstep`'s
// own S-shape (slow-fast-slow) still gives an earlier partial-reveal beat
// (pillars separating from darkness, not yet fully visible) for free.
const IGNITE_START = 0
const IGNITE_END = 0.06

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
