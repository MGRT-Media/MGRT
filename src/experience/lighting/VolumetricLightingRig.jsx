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
// values, never camera position or orientation.
//
// IGNITE_END lowered from 0.4 per explicit follow-up ("light enters the
// room too late... by the time the camera approaches the monitor, the
// room should already be filled with light"). 0.4 in *progress* terms was
// already an early fraction of the full 0-1 timeline, but the Intro's own
// hard rate cap (filmActBeats.js's INTRO_MAX_RATE_PER_SECOND) means
// progress itself now advances much more slowly in *wall-clock* time
// through the early part of the scroll than it used to — so a ramp that
// completed at progress 0.4 was taking noticeably longer in real seconds
// to finish than it looks like on paper. 0.25 keeps the same "immediate
// start, thoroughly lit by the approach" shape while actually completing
// sooner in practice.
const IGNITE_START = 0
const IGNITE_END = 0.25

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
