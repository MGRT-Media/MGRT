import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { sunDirection } from './volumetricLighting.js'

/**
 * The sky HDRI — loaded once, shared by everything that needs it.
 *
 * Two things in this scene want this image: `SceneEnvironment` needs it as an
 * irradiance source, and `SunsetSky` needs it as the thing you actually see
 * through the court. Loading it twice would mean two 5MB fetches, two RGBE
 * decodes and two copies resident on the GPU, so the promise is memoised here
 * and both consumers await the same one. The PMREM cube that
 * `SceneEnvironment` derives is the only additional GPU allocation.
 *
 * Deliberately NOT wrapped in `useLoader`/Suspense. The scene sits inside a
 * `Suspense fallback={null}`, so suspending on a 5MB file would blank the
 * entire experience until it arrived — and this project's stated loading
 * philosophy is that the void is the loader, not that the room disappears.
 * Both consumers therefore start from what they already have (a procedural
 * gradient, and `RoomEnvironment`) and upgrade in place when the file lands.
 * That is the same pattern `stoneWallMaterial.js` uses for its scanned maps.
 */
export const SKY_HDRI_URL = '/environment/evening-road-puresky-2k.hdr'

/**
 * Where this particular HDRI's sun sits, measured from the file rather than
 * assumed: the brightest texel of the 2048x1024 image is at (1220, 455),
 * which in three's `equirectUv` convention is a horizontal bearing of 0.6026
 * radians and an elevation of 9.9 degrees.
 */
const HDRI_SUN_BEARING = 0.6026

/**
 * How far to turn the sky so its sun agrees with the room's.
 *
 * Derived from `sunDirection()` rather than typed in, so the two can never
 * drift apart: rotating the sampling direction by this angle maps the scene's
 * own sun bearing onto the HDRI's. Without it the brightest part of the sky
 * would sit at one bearing while the shaft came from another, which the eye
 * reads immediately as two unrelated effects.
 *
 * Only the AZIMUTH is aligned, and that is a deliberate limit. This HDRI's sun
 * is 9.9 degrees above its horizon while the room's is at 68; tipping the
 * image to match would put the horizon on a slant, and a tilted horizon
 * through a hole in a ceiling is far more obviously wrong than a sun you
 * cannot see. At 68 degrees the shaft comes from well above anything the
 * aperture reveals anyway — what shows through the opening is upper sky, which
 * is what the brief's "cinematic realism, not a dramatic sky" asks for.
 */
export const SKY_ROTATION_Y = (() => {
  const dir = sunDirection()
  return Math.atan2(dir.z, dir.x) - HDRI_SUN_BEARING
})()

let pending = null

/** The shared texture. Resolves to the same instance for every caller. */
export function loadSkyTexture() {
  if (!pending) {
    pending = new RGBELoader().loadAsync(SKY_HDRI_URL).then((texture) => {
      // Required by `PMREMGenerator.fromEquirectangular`, and correct for the
      // dome too — RGBELoader leaves the mapping as plain UV.
      texture.mapping = THREE.EquirectangularReflectionMapping
      return texture
    })
  }
  return pending
}
