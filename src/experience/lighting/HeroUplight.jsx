import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { WALL_INSCRIPTION_CENTER, WALL_INSCRIPTION_NORMAL } from '../architecture/wallInscription.js'
import { contentValue } from '../timeline/contentProgress.js'
import { HERO_T } from '../timeline/filmActBeats.js'

/**
 * A warm uplight at the foot of the MGRT wall, for the hero stage only.
 *
 * One real `SpotLight` and nothing else: no glow sprite, no emissive, no
 * decal. The wash on the wall is the light actually arriving at the stone, so
 * it breaks over the stone's own normal map, grazes the lettering's chamfers
 * and rakes the inner flanks of the engaged columns exactly as it would in a
 * lit set — which is what keeps it photographed rather than applied.
 *
 * Why the shape is not a circle: the fixture sits low and close to the wall,
 * so the beam meets the stone at a grazing angle. Inverse-square falloff over
 * that raking distance stretches it into a tall, soft wash that is brightest
 * near the floor and thins as it climbs, with the cone's wide penumbra losing
 * it sideways before any hard edge can form.
 *
 * Supporting, not replacing. The room's own ignition ramp still reveals the
 * wordmark; this adds a secondary, motivated source during the one beat it
 * belongs to and is gone everywhere else.
 */

/** Warm tungsten, around 3200K — held short of amber so the stone keeps its own colour. */
const COLOR = '#ffc690'
/** Luminous intensity at full level, in candela (decay 2 = physical falloff). */
const CANDELA = 80
/**
 * How far out from the wall the fixture stands, along the wall's normal.
 *
 * Set by inverse-square, measured rather than guessed. The columns' inner
 * flanks are ~2x further from a close fixture than the foot of the wall is, so
 * at 2.6m they received about 12% of the wall's added light — a cone sweep
 * from 56 to 72 degrees changed that by almost nothing, because it was
 * distance and not the cone limiting it. Compared side by side at the hero
 * pose, 2.6m gave the best rising-beam character and 3.4m the most light on
 * the flanks but a broad, even wash that read as a lit logo wall. 3.0m keeps
 * the climb from the floor and still reaches the flanks. The floor here is outside the hero frame at every
 * aspect, so the fixture itself is never in shot.
 */
const STANDOFF = 3.0
/** Just above the floor, below the hero frame's lower edge. */
const FIXTURE_HEIGHT = 0.12
/** Aim point height on the wall — above the wordmark's centre, so the hottest part of the throw is the lower wall. */
const AIM_HEIGHT = 4.3
/** Half-angle wide enough that the columns' inner flanks sit inside the penumbra. */
const CONE_ANGLE = THREE.MathUtils.degToRad(56)
const PENUMBRA = 0.7

/**
 * Hero-stage level, as a pure function of the rendered progress.
 *
 * Rises over `RISE_START` -> `RISE_END`, which is the camera's own final glide
 * onto the wordmark, and holds at full from there while the camera rests on the
 * hero, the end of the journey.
 * Below `RISE_START` it is exactly zero — the Digital beat (0.6) and the Film
 * beat (0.45) are far outside it.
 *
 * `renderedProgress` rather than raw scroll: it is the value the camera itself
 * is placed from, including the journey's own clamping at the hero, so the light
 * can never run ahead of or behind the shot it belongs to. The same progress
 * always gives the same level, so reversing is automatically exact — there is
 * no state and nothing one-way.
 */
export const HERO_UPLIGHT_RISE_START = 0.8
export const HERO_UPLIGHT_RISE_END = 0.876

export function heroUplightLevel(progress) {
  const t = THREE.MathUtils.clamp(
    (progress - HERO_UPLIGHT_RISE_START) / (HERO_UPLIGHT_RISE_END - HERO_UPLIGHT_RISE_START),
    0,
    1,
  )
  // smootherstep: zero slope and zero curvature at both ends, so the light
  // neither pops on at the start of the glide nor lurches at full.
  return t * t * t * (t * (t * 6 - 15) + 10)
}

const RISE_SANITY = HERO_UPLIGHT_RISE_END <= HERO_T

export default function HeroUplight() {
  const light = useMemo(() => {
    const [cx, , cz] = WALL_INSCRIPTION_CENTER
    const [nx, , nz] = WALL_INSCRIPTION_NORMAL
    const spot = new THREE.SpotLight(COLOR, 0, 0, CONE_ANGLE, PENUMBRA, 2)
    spot.position.set(cx + nx * STANDOFF, FIXTURE_HEIGHT, cz + nz * STANDOFF)
    spot.target.position.set(cx, AIM_HEIGHT, cz)
    /**
     * No shadow map. A spot shadow is a second full render of the room every
     * frame, and here it would buy almost nothing: the lettering stands 12mm
     * proud (sub-texel at any usable shadow resolution), and the one real
     * shadow — each column's outer side onto the wall — falls outside the hero
     * frame. The column flanks still read as lit and unlit by the cone and by
     * their own orientation to the light, which is where the depth comes from.
     */
    spot.castShadow = false
    return spot
  }, [])

  useFrame(() => {
    // Content progress on the rendered (journey) base — see `contentProgress.js`.
    light.intensity = CANDELA * contentValue(heroUplightLevel, 'rendered')
  })

  if (!RISE_SANITY) throw new Error('HeroUplight rise must complete by HERO_T')

  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  )
}
