import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { isExteriorActive } from '../timeline/heroSequence.js'
import { EXTERIOR_LAYER } from './layers.js'
import { ENVIRONMENT_INTENSITY, FOG_DENSITY, SKY_ROTATION_Y, exteriorAtmosphere } from './exteriorAtmosphere.js'

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
 * The exterior's own atmosphere, applied with the layer swap.
 *
 * The room and the Campaigns world share one scene, so fog and environment
 * lighting are shared state. While the exterior is on screen it takes its own
 * daylight — the supplied sky as environment lighting, turned to its sun, and a
 * haze coloured by that sky's horizon at a density suited to distances in the
 * hundreds of units (`exteriorAtmosphere.js`). The room's values are read from
 * the scene when the exterior takes over and put back when it hands back,
 * rather than duplicated here, so nothing about the room can drift.
 *
 * Applied every exterior frame rather than once, because the sky's lighting
 * file may still be arriving when the exterior first appears — the frame it
 * lands, the world is lit by it. The assignments cost nothing.
 */

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
  const interiorAtmosphere = useRef(null)
  const showingExterior = useRef(null)

  useFrame(({ camera, scene }) => {
    if (interiorFar.current === null) interiorFar.current = camera.far

    // Keyed off where the camera ACTUALLY is, not off scroll progress — see
    // `campaignsRailDistance`'s own comment for why the two are not
    // interchangeable here and what keying off progress broke.
    /**
     * The hand-over point: the exact instant the wordmark is full-frame.
     *
     * Keyed to the hero rather than to a distance along the old rail, because
     * that is the one frame where the wall and the billboard are showing the
     * identical image — the board sits where the wall was, at the same depth
     * and the same angle, carrying a render taken from this very eye point.
     * Swapping here means the only thing that changes is which object is
     * drawing those pixels, which is why there is nothing to see: no cut, no
     * fade, no scale pop, nothing to cover.
     *
     * Owned by the state machine, NOT by a progress threshold. The test used
     * to be `renderedProgress >= HERO_T`, which fired on the first frame of
     * the hold — because the machine pins progress to exactly `HERO_T` there —
     * so the viewer watched the billboard for the whole 1.5 seconds and the
     * pull-back had nothing left to reveal. The interior now stays up for the
     * entire hold and the exterior appears only as the pull-back starts.
     */
    const exterior = isExteriorActive()
    if (exterior !== showingExterior.current) {
      const wasExterior = showingExterior.current
      showingExterior.current = exterior

      camera.layers.set(exterior ? EXTERIOR_LAYER : 0)
      camera.far = exterior ? EXTERIOR_FAR : interiorFar.current
      camera.updateProjectionMatrix()

      if (exterior) {
        interiorAtmosphere.current = {
          fogDensity: scene.fog?.density,
          fogColor: scene.fog?.color.clone(),
          environment: scene.environment,
          environmentIntensity: scene.environmentIntensity,
          environmentRotationY: scene.environmentRotation.y,
        }
      } else if (wasExterior && interiorAtmosphere.current) {
        const room = interiorAtmosphere.current
        if (scene.fog) {
          scene.fog.density = room.fogDensity
          scene.fog.color.copy(room.fogColor)
        }
        scene.environment = room.environment
        scene.environmentIntensity = room.environmentIntensity
        scene.environmentRotation.y = room.environmentRotationY
      }
    }

    if (!exterior) return
    if (scene.fog) {
      scene.fog.density = FOG_DENSITY
      scene.fog.color.copy(exteriorAtmosphere.fogColor)
    }
    if (exteriorAtmosphere.environment) {
      scene.environment = exteriorAtmosphere.environment
      scene.environmentIntensity = ENVIRONMENT_INTENSITY
      scene.environmentRotation.y = SKY_ROTATION_Y
    } else {
      // Until the sky's lighting arrives, nothing rather than the room's sky.
      scene.environmentIntensity = 0
    }
  })

  return null
}
