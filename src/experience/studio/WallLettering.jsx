import { useEffect, useMemo } from 'react'
import { letteringGeometry } from './studioAssets.js'
import { LETTERING_CENTER } from './studioLayout.js'
import { createBronzeMaterial } from './studioMaterials.js'

/**
 * The MGRT / MEDIA wall lettering: physical letters, cut from Cormorant
 * Medium, standing just off the plaster.
 *
 * The model (`public/models/studio/wall-lettering.glb`, built by
 * `scripts/build-wall-lettering.mjs`) is geometry only, in metres and centred
 * on the wordmark's block, so it is placed by `LETTERING_CENTER` and nothing
 * else. Its finish is the scene's: aged bronze for now, provisional until
 * approved (`LOOK.bronze`).
 *
 * It casts a shadow as well as receiving one. The gap between the letters and
 * the wall is only read through the shadow they drop onto it.
 */
export default function WallLettering({ environment }) {
  const geometry = letteringGeometry()
  const material = useMemo(() => createBronzeMaterial(environment), [environment])
  useEffect(() => () => material.dispose(), [material])

  // The model failed to load: the wall stays bare rather than the page failing.
  if (!geometry) return null

  return <mesh geometry={geometry} material={material} position={LETTERING_CENTER} castShadow receiveShadow />
}
