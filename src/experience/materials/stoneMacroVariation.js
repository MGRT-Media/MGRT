import * as THREE from 'three'
import { fbm3 } from '../architecture/stoneNoise.js'

/**
 * Macro variation — the scale of detail that sits between the texture and the
 * architecture, and the piece this room was missing.
 *
 * Every stone surface here is one photographed tile repeated. On the shell
 * that is 18 repeats around the sweep and nearly 2 up its height; on the floor
 * it is more. The scan itself is good, and at arm's length it reads as stone —
 * but a photograph tiled at a fixed 4.2 units carries no information at any
 * scale LARGER than 4.2 units, so every bay of the wall is identical to every
 * other bay. That is what produces the two complaints at once: the repeat
 * announces itself, and because the only colour left is the tile's average,
 * the whole room settles into a single flat beige that the warm sunlight then
 * pushes toward orange.
 *
 * Real weathered stone varies over metres, not centimetres: whole courses run
 * paler where they have been rained on, whole corners run darker where they
 * have not dried in years. This adds that band — a low-frequency field baked
 * into vertex colour and multiplied into the albedo.
 *
 * **Vertex colour rather than a second texture, deliberately.** It needs no new
 * asset, no extra sampler, no UV set and no download; it is evaluated once at
 * build time and costs one interpolated attribute per vertex thereafter. The
 * geometry is already dense enough to carry it — the shell alone has 28k
 * vertices, which resolves a field measured in metres far more finely than it
 * needs.
 *
 * It changes no vertex position. Nothing about the architecture moves.
 */

/** Field scales, in world units — both well above the 4.2-unit texture tile. */
const BROAD_SCALE = 0.15
const MOTTLE_SCALE = 0.52

/**
 * How the stone's colour shifts across that field.
 *
 * Not simply light-to-dark, because that alone would read as dirt sprayed on.
 * Exposed high patches are sun-bleached: paler AND slightly COOLER, the way
 * limestone goes chalky where the weather reaches it. Sheltered low patches
 * hold their patina: darker and warmer. Running the tilt this way round is
 * also what takes the orange down — it desaturates precisely the bright
 * surfaces the sun is already warming, which is where the excess sat.
 */
const TILT_RED = 0.05
const TILT_BLUE = 0.10

/**
 * Applies the field to a geometry as a `color` attribute.
 *
 * `range` is the darkest and lightest multiplier. It is centred on 1.0 rather
 * than darkening on average, so this adds irregularity without changing the
 * room's overall exposure — the approved lighting still lands where it landed.
 *
 * `toWorld` maps a local vertex to the world position the field should be
 * sampled at. The floor is a plane the mesh rotates into place, so its local
 * axes are not world axes; passing the mapping keeps its variation continuous
 * with the walls it meets instead of running in a different direction.
 */
export function applyStoneMacroVariation(geometry, options = {}) {
  const { seed = 11, range = [0.80, 1.16], toWorld = (x, y, z) => [x, y, z] } = options
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)

  for (let i = 0; i < position.count; i += 1) {
    const [x, y, z] = toWorld(position.getX(i), position.getY(i), position.getZ(i))

    const broad = fbm3(x * BROAD_SCALE, y * BROAD_SCALE, z * BROAD_SCALE, 3, seed)
    const mottle = fbm3(x * MOTTLE_SCALE, y * MOTTLE_SCALE, z * MOTTLE_SCALE, 2, seed + 91)
    const t = THREE.MathUtils.clamp(0.5 + broad * 0.58 + mottle * 0.2, 0, 1)

    const level = THREE.MathUtils.lerp(range[0], range[1], t)
    const tilt = (t - 0.5) * 2

    colors[i * 3] = level * (1 - tilt * TILT_RED)
    colors[i * 3 + 1] = level
    colors[i * 3 + 2] = level * (1 + tilt * TILT_BLUE)
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}
