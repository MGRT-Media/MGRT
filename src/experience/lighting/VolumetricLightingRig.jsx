import { useEffect, useMemo } from 'react'
import { createVolumetricLighting } from './volumetricLighting.js'

/**
 * Thin R3F adapter around the framework-agnostic lighting controller.
 * Mounts once, disposes on unmount. The lighting is fully static — no
 * `useFrame`, no scroll-coupling — the beam's own truncated geometry
 * (see `volumetricLighting.js`) is what keeps the camera transition free
 * of a pop, not a runtime fade.
 */
export default function VolumetricLightingRig() {
  const controller = useMemo(() => createVolumetricLighting(), [])

  useEffect(() => {
    controller.init()
    return () => controller.dispose()
  }, [controller])

  // dispose={null}: disposal is handled by controller.dispose() above; R3F's
  // own auto-dispose traversal doesn't expect imperatively-nested lights and
  // groups and errors on unmount without this.
  return <primitive object={controller.group} dispose={null} />
}
