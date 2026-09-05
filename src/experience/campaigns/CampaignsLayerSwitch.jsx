import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CAMPAIGNS_SWAP_DISTANCE, campaignsRailDistance } from '../timeline/cameraPath.js'
import { EXTERIOR_LAYER } from './layers.js'

// The exterior needs a far plane deep enough to contain its ground plane,
// which extends much further than anything the interior ever did. Rather
// than raising the shared far plane permanently — which would stretch the
// depth buffer across the whole experience and risk z-fighting in the
// already-approved interior — it is raised only while the exterior is what
// is being rendered, and restored on the way back. The interior's own value
// is read off the camera at first frame rather than duplicated here, so it
// cannot drift from `CinematicExperience.jsx`'s canvas config.
const EXTERIOR_FAR = 400

/**
 * The single point where Act 3's reveal actually happens: at
 * `CAMPAIGNS_SWAP_T` the main camera stops rendering the interior layer and
 * starts rendering the exterior one, where the billboard is showing that
 * same interior live (`Billboard.jsx`).
 *
 * This is a swap of what is drawn, never a cut in the movement: the camera
 * itself does not move, turn, or change speed here — it is mid-dolly, on a
 * path that knows nothing about this boundary — and the two images are
 * identical at the instant they trade places, by the construction described
 * in `Billboard.jsx`. It is a pure function of the camera's own position,
 * so scrolling back through the boundary restores the interior exactly,
 * with no state to unwind.
 *
 * Kept as its own component rather than folded into `Billboard.jsx` because
 * it is the one piece of Act 3 that reaches out and mutates shared state
 * (the main camera) — worth being able to find on its own.
 */
export default function CampaignsLayerSwitch() {
  const interiorFar = useRef(null)
  const showingExterior = useRef(null)

  useFrame(({ camera }) => {
    if (interiorFar.current === null) interiorFar.current = camera.far

    // Keyed off where the camera ACTUALLY is, not off scroll progress — see
    // `campaignsRailDistance`'s own comment for why the two are not
    // interchangeable here and what keying off progress broke.
    const exterior = campaignsRailDistance(camera.position) >= CAMPAIGNS_SWAP_DISTANCE
    if (exterior === showingExterior.current) return
    showingExterior.current = exterior

    camera.layers.set(exterior ? EXTERIOR_LAYER : 0)
    camera.far = exterior ? EXTERIOR_FAR : interiorFar.current
    camera.updateProjectionMatrix()
  })

  return null
}
