import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { MODEL_URLS } from '../models/modelAssets.js'
import { preloadScannedStone, scannedStoneUrls } from '../materials/scannedStone.js'
import { assetUrl } from '../assets/assetUrl.js'
import { SKY_BOOT_URL, loadSkyTexture } from '../lighting/skyEnvironment.js'

/**
 * Everything the opening frame needs, fetched before the scene is built.
 *
 * The room is designed to upgrade in place: geometry and stand-in materials
 * exist synchronously, and the downloaded files replace them as they land.
 * That is the right architecture — it is what keeps the experience off a
 * single blocking load — but it means the visitor watches the upgrades
 * happen. This module removes the watching without removing the design: by
 * the time the scene mounts, every file below is already in the HTTP cache,
 * so each in-place swap completes within a frame or two instead of seconds,
 * and `SceneReady` holds the canvas out of sight across those frames.
 *
 * CRITICAL means "the opening frame cannot be drawn correctly without it".
 * The brass inlay maps are NOT here: measured against the capture harness's
 * own noise they change no beat visibly, so they load once the opening is on
 * screen (`deferredAssets.js`). The chapter videos are absent too: their
 * elements carry `preload = 'none'` and together they are 60MB.
 *
 * The memoised promise is also what makes returning from /work, /about or
 * /contact cheap — the second call resolves immediately, so the gate opens on
 * the next frame instead of repeating a load the browser has already done.
 */

/**
 * The four models standing in the room.
 */
const CRITICAL_MODEL_URLS = [
  MODEL_URLS.camera,
  MODEL_URLS.cameraStand,
  MODEL_URLS.monitor,
  MODEL_URLS.pedestal,
]

/** Every surface the camera can see at progress 0 is one of these three sets. */
const CRITICAL_STONE_SETS = ['walls', 'floors', 'columns']

/**
 * Development guard: the HTML's preload hints (`heroAssets.js`) and this
 * preflight have to describe the same set of files, or the browser either
 * fetches something twice or warns about a hint nothing used.
 */
if (import.meta.env.DEV) {
  import('./heroAssets.js').then(({ HERO_PRELOADS }) => {
    const preloaded = new Set(HERO_PRELOADS.map((p) => assetUrl(p.path)))
    const waited = new Set([...CRITICAL_MODEL_URLS, ...CRITICAL_STONE_SETS.flatMap(scannedStoneUrls), SKY_BOOT_URL])
    const missing = [...waited].filter((u) => !preloaded.has(u))
    const extra = [...preloaded].filter((u) => !waited.has(u))
    if (missing.length || extra.length) {
      console.warn('[criticalAssets] preload hints and preflight disagree.', { missing, extra })
    }
  })
}

let pending = null
let settled = false

/**
 * True once the preflight has completed in this session — which is what makes
 * a return from an internal page feel instant rather than like a second load.
 */
export function criticalAssetsSettled() {
  return settled
}

/**
 * Starts the preflight. Resolves once every file has either loaded or failed:
 * nothing here rejects, so a missing file costs its own upgrade and never the
 * opening.
 */
export function preloadCriticalAssets() {
  if (pending) return pending

  /*
   * Models go through R3F's own loader cache, not a bare `fetch`, and one URL per
   * call — NOT the array form. `useLoader` keys its cache on the arguments it
   * was given, so a single `preload(Loader, [a, b, c])` stores one entry under
   * the whole array and the components' own `useLoader(Loader, a)` misses it
   * and re-fetches. Measured: three requests per model instead of one.
   *
   * Per-URL also fixes a waterfall this preflight would otherwise inherit.
   * `CinemaCamera` and `Monitor` each request their second model only after
   * their first has resolved and the component has re-rendered, which put
   * `camera-stand` and `digital-stone` ~960ms behind the other two. Started
   * here, all four are in flight at once.
   *
   * Meshopt must be attached here too: these files do not load without it.
   *
   * These are deliberately absent from the promise below. They need no
   * readiness signal of their own because `SceneReady` is mounted inside the
   * same `Suspense` boundary they suspend — React already knows when they are
   * ready, and awaiting them here as well would only duplicate the request.
   */
  CRITICAL_MODEL_URLS.forEach((url) => {
    useLoader.preload(GLTFLoader, url, (loader) => loader.setMeshoptDecoder(MeshoptDecoder))
  })

  pending = Promise.all([
    // The same memoised promise `SceneEnvironment` and `SunsetSky` await, so
    // this is the real load rather than a duplicate of it: by the time they
    // ask, the texture is decoded and only the PMREM pass remains.
    loadSkyTexture().catch(() => null),
    /*
     * Stone goes through `preloadScannedStone` rather than a bare `fetch`, and
     * the difference matters: a fetch only puts BYTES in the HTTP cache, leaving the
     * decode to whichever material asked first. This decodes each file once,
     * here, and keeps the `Texture`, which is what lets `createStoneWallMaterial`
     * build straight from the scan instead of generating a stand-in it would
     * only throw away. Same requests, same count — just finished properly.
     */
    ...CRITICAL_STONE_SETS.map(preloadScannedStone),
  ]).then(() => {
    settled = true
  })

  return pending
}
