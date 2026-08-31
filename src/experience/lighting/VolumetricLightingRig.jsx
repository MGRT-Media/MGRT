import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { createVolumetricLighting } from './volumetricLighting.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'

/**
 * Thin R3F adapter around the framework-agnostic volumetric lighting
 * controller. Calls `controller.update(scrollProgress.value)` every frame
 * — a narrowly-scoped exception to "lighting is static," used only to fade
 * the beam across the Phase 1D camera→monitor crossing (see
 * `volumetricLighting.js`'s `BEAM_FADE_START`/`BEAM_FADE_END`). Reads the
 * same plain mutable `scrollProgress` object `ScrollCameraRig` uses — not
 * React state, per technical-architecture.md §7.
 */
export default function VolumetricLightingRig() {
  const controller = useMemo(() => createVolumetricLighting(), [])

  useEffect(() => {
    controller.init()
    return () => controller.dispose()
  }, [controller])

  useFrame(() => {
    controller.update(scrollProgress.value)
  })

  // dispose={null}: disposal is handled by controller.dispose() above; R3F's
  // own auto-dispose traversal doesn't expect imperatively-nested lights and
  // groups and errors on unmount without this.
  return <primitive object={controller.group} dispose={null} />
}
