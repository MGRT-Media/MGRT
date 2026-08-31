import { useEffect, useMemo } from 'react'
import { createVolumetricLighting } from './volumetricLighting.js'

/**
 * Thin R3F adapter around the framework-agnostic volumetric lighting
 * controller. Phase 1C will call `controller.update(time)` from the shared
 * cinematic timeline; Phase 1B intentionally never calls it, so no
 * per-frame work happens while the lighting is static.
 */
export default function VolumetricLightingRig() {
  const controller = useMemo(() => createVolumetricLighting(), [])

  useEffect(() => {
    controller.init()
    return () => controller.dispose()
  }, [controller])

  return <primitive object={controller.group} />
}
