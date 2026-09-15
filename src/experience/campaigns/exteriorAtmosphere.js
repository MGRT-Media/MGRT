import * as THREE from 'three'
import { assetUrl } from '../assets/assetUrl.js'

/**
 * The Campaigns sky and daylight, in one place.
 *
 * One photographed sky, prepared as two production files from the same 2K
 * source (kept outside `public/`, in `source-assets/textures/sky/`):
 *
 *  - `sky-backdrop.avif` — what you see: the full 2048x1024 panorama as an
 *    8-bit image storing radiance / `SKY_BACKDROP_SCALE`, so everything but the
 *    sun's core survives the 8 bits;
 *  - `sky-lighting-1k.hdr` — what lights the world: a 1024x512 box downsample
 *    that keeps the true HDR range, turned into a PMREM environment.
 *
 * Nothing here touches the room. `CampaignsLayerSwitch` applies these values
 * only while the exterior layer is being rendered, and restores the room's own
 * afterwards.
 */
export const SKY_BACKDROP_URL = assetUrl('/textures/sky/sky-backdrop.avif')
export const SKY_LIGHTING_URL = assetUrl('/textures/sky/sky-lighting-1k.hdr')
export const SKY_BACKDROP_SCALE = 6

/**
 * The HDRI's own sun, measured from the file: the luminance-weighted centroid
 * of the disc, in three's equirectangular convention.
 */
const HDRI_SUN_BEARING = 0.5979
const HDRI_SUN_ELEVATION = THREE.MathUtils.degToRad(47.9)

/**
 * Where the exterior's sun is: behind the camera and to its left, the bearing
 * the exterior key light has always had, so the billboard face stays lit from
 * the front and the sun never enters the frame. The elevation is the
 * photograph's, so the light and the sky agree about how high the sun is.
 */
const SUN_BEARING = Math.atan2(40, -30)

export const SUN_DIRECTION = new THREE.Vector3(
  Math.cos(HDRI_SUN_ELEVATION) * Math.cos(SUN_BEARING),
  Math.sin(HDRI_SUN_ELEVATION),
  Math.cos(HDRI_SUN_ELEVATION) * Math.sin(SUN_BEARING),
)

/**
 * Turns the sky so its sun lands on `SUN_BEARING`. The same convention the
 * room's `skyEnvironment.js` uses for its own sky: the dome rotates its
 * sampling direction by this angle, and `scene.environmentRotation` takes the
 * same value, so what is seen and what lights the world agree.
 */
export const SKY_ROTATION_Y = SUN_BEARING - HDRI_SUN_BEARING

/**
 * Exposure balance, all against the renderer's untouched exposure of 1.
 *
 * The billboard shows the room as a render and is unlit, so it cannot be
 * brightened to compete with the sky; everything outside is pitched so the
 * artwork remains the brightest, most readable surface in the frame. The sky is
 * held down to where its blue survives ACES's shoulder, the sun and
 * environment are balanced so the ground reads as daylight without washing
 * out, and the haze is thin enough that the hills keep their shape.
 */
export const SKY_INTENSITY = 0.36
export const ENVIRONMENT_INTENSITY = 0.32
export const SUN_INTENSITY = 1.35
export const SUN_COLOR = new THREE.Color('#fff2e0')
export const FOG_DENSITY = 0.0034

/**
 * Filled in by `DaySky` once the lighting file is decoded: the PMREM
 * environment and the haze colour, which is the sky's own horizon at the same
 * intensity the dome is drawn at, so distant ground dissolves into the sky
 * rather than into a grey of its own. Read by `CampaignsLayerSwitch`.
 */
export const exteriorAtmosphere = {
  environment: null,
  fogColor: new THREE.Color('#9fb0c2'),
}
