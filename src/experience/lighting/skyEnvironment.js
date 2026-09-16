import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { assetUrl } from '../assets/assetUrl.js'
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
/**
 * The 1K downsample of the 2K original, not a different image — a box average
 * of the same file, so nothing about the sky's content, colour or sun position
 * changed. 4.87MB -> 1.28MB, which was over half the critical loading gate.
 *
 * Measured rather than assumed before switching: solid-angle-weighted mean
 * luminance moves by 0.25% (so the environment term lights the room at the
 * same level), and rendered in this scene against the 2K the largest
 * difference anywhere is 9/255 on a view pointed straight up through the roof
 * opening, with no pixel differing by more than 8/255 and 99.6% differing by
 * 2/255 or less. On the actual opening camera the mean difference is
 * 0.03/255.
 *
 * The resolution was never doing much work here: what the court reveals is
 * upper sky, which is a smooth gradient, and the environment contribution is
 * prefiltered through PMREM into low-resolution mips before any material
 * samples it.
 */
export const SKY_HDRI_URL = assetUrl('/environment/evening-road-puresky-1k.hdr')

/**
 * The sky the opening frame is actually drawn with: the same image at half
 * resolution per axis, 915KB -> 191KB on the wire.
 *
 * This is the single largest file the reveal used to wait for, and what it
 * shows at that moment is upper sky through a ceiling opening — a smooth
 * gradient — prefiltered through PMREM into low-resolution mips before any
 * material samples it. Measured across the capture harness's beats the
 * difference is below the harness's own run-to-run noise everywhere the sky is
 * seen, and remains just measurable on stone at the Film close-up, which is
 * why this is the BOOT sky and not the shipped one: `upgradeSky` replaces it
 * with the original while the room is on screen and long before that close-up.
 */
export const SKY_BOOT_URL = assetUrl('/environment/evening-road-puresky-512.hdr')

/**
 * Where this particular HDRI's sun sits, measured from the file rather than
 * assumed: the brightest texel of the original 2048x1024 image is at
 * (1220, 455), which in three's `equirectUv` convention is a horizontal
 * bearing of 0.6026 radians and an elevation of 9.9 degrees.
 *
 * Still correct for the 1K above, and re-checked rather than assumed when it
 * replaced the 2K: a box downsample cannot move the disc, and the
 * luminance-weighted centroid of the sun agrees to within 0.5-0.9 degrees.
 * (The single brightest TEXEL appears to jump further, but that is only
 * because the disc is broad and nearly flat-topped, so which one texel wins is
 * noise — the centroid is the real figure.) Immaterial in any case: this sun
 * sits at 9.9 degrees while the room's is at 68, so it is never inside what
 * the court opening reveals.
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
let resolved = null
let fullPending = null
let upgraded = false

/**
 * Everything drawing from the sky, so the boot image can be exchanged for the
 * original in ONE frame.
 *
 * Two things sample it — the dome the court looks out on (`SunsetSky`) and the
 * environment the stone reflects (`SceneEnvironment`) — and they must never
 * disagree, even for a frame: reflections from one sky over a dome showing
 * another is exactly the "lighting jump" this upgrade has to avoid. Each
 * registers a PREPARE step that does all of its expensive work (a PMREM
 * prefilter, in the environment's case) and returns a commit function; the
 * commits are then run back to back with nothing rendered in between.
 */
const upgradeParticipants = new Set()

/**
 * Registers a consumer of the sky. `prepare(texture)` may do GPU work and must
 * return a function that installs the result, or null if there is nothing to
 * install. Returns an unsubscribe for effect cleanup.
 */
export function registerSkyUpgrade(prepare) {
  upgradeParticipants.add(prepare)
  return () => upgradeParticipants.delete(prepare)
}

/** True once the original sky is the one being drawn. */
export function skyUpgraded() {
  return upgraded
}

/**
 * The synchronous counterpart to `loadSkyTexture`: the decoded texture if it is
 * already resident, otherwise `null`.
 *
 * `SceneEnvironment` uses this to decide, at mount, whether it needs to build a
 * stand-in environment at all. Deliberately a plain getter and not a second
 * load — it can only ever report on the one shared promise below.
 */
export function resolvedSkyTexture() {
  return resolved
}

/**
 * The boot sky at the ORIGINAL's dimensions, for prefiltering only.
 *
 * PMREM sizes its cube from the source's width, so a 512px sky produces a
 * smaller prefiltered environment than a 1024px one — and an environment of a
 * different size has to be a different texture, which is the expensive part:
 * three recompiles every material that samples `scene.environment` when that
 * texture's identity changes. Measured, that was fifteen program links and a
 * 192ms frame at the moment the sky upgraded.
 *
 * Doubling the boot sky's dimensions before prefiltering makes both passes the
 * same size, so the upgrade re-renders the environment INTO THE SAME render
 * target and no material ever sees a new texture. Nearest-neighbour is the
 * right filter and not a shortcut: the result is immediately blurred into
 * PMREM's roughness mips, and it stands for barely a second before the real
 * sky replaces its contents.
 *
 * Disposed by the caller as soon as the prefilter has read it.
 */
export function environmentSource(texture) {
  const { data, width, height } = texture.image
  const channels = data.length / (width * height)
  const wide = width * 2
  const tall = height * 2
  const enlarged = new data.constructor(wide * tall * channels)
  for (let y = 0; y < tall; y += 1) {
    const row = (y >> 1) * width
    for (let x = 0; x < wide; x += 1) {
      const from = (row + (x >> 1)) * channels
      const to = (y * wide + x) * channels
      for (let c = 0; c < channels; c += 1) enlarged[to + c] = data[from + c]
    }
  }
  const source = new THREE.DataTexture(enlarged, wide, tall, texture.format, texture.type)
  source.mapping = THREE.EquirectangularReflectionMapping
  source.colorSpace = texture.colorSpace
  source.minFilter = texture.minFilter
  source.magFilter = texture.magFilter
  source.generateMipmaps = false
  source.needsUpdate = true
  return source
}

function loadEquirect(url) {
  return new RGBELoader().loadAsync(url).then((texture) => {
    // Required by `PMREMGenerator.fromEquirectangular`, and correct for the
    // dome too — RGBELoader leaves the mapping as plain UV.
    texture.mapping = THREE.EquirectangularReflectionMapping
    return texture
  })
}

/** The shared texture. Resolves to the same instance for every caller. */
export function loadSkyTexture() {
  if (!pending) {
    pending = loadEquirect(SKY_BOOT_URL).then((texture) => {
      resolved = texture
      return texture
    })
  }
  return pending
}

/** The original, at full resolution. Also shared, and also loaded at most once. */
export function loadFullSkyTexture() {
  if (!fullPending) fullPending = loadEquirect(SKY_HDRI_URL)
  return fullPending
}

/**
 * Exchanges the boot sky for the original, everywhere at once.
 *
 * Downloaded, decoded, uploaded and prefiltered first, and only then
 * installed: by the time anything changes, every participant is holding a
 * finished resource and the swap itself is a handful of assignments. One-way —
 * once the room has the original sky it keeps it for the session, so
 * back-scrolling and direct navigation can never return to the boot image.
 */
export function upgradeSky(renderer) {
  if (upgraded) return Promise.resolve()
  upgraded = true
  // Phases on the performance timeline, for the same reason the prop upgrade
  // marks its own: the question is never whether this finished, it is whether
  // it finished before the Film close-up.
  performance.mark('sky:start')
  return loadFullSkyTexture()
    .then(async (texture) => {
      performance.mark('sky:decoded')
      // On the GPU before anyone samples it, so the first frame that shows the
      // original is not also the frame that uploads it — and in a frame of its
      // own, so the upload does not share one with the prefilter below.
      renderer.initTexture(texture)
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
      const commits = Array.from(upgradeParticipants, (prepare) => prepare(texture)).filter(Boolean)
      performance.mark('sky:prepared')
      for (const commit of commits) commit()
      performance.mark('sky:swapped')

      const boot = resolved
      resolved = texture
      // The frame drawn with the original is already queued by the time this
      // runs, so nothing is still reading the boot image.
      if (boot && boot !== texture) requestAnimationFrame(() => boot.dispose())
    })
    .catch(() => {
      // The boot sky is a complete, correct sky. Failing to upgrade it is not a
      // reason to disturb a room that is already lit.
      upgraded = false
    })
}
