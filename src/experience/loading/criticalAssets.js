import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { MODEL_URLS } from '../models/modelAssets.js'
import { preloadScannedStone } from '../materials/scannedStone.js'
import { BRASS_URLS } from '../architecture/wallInscription.js'
import { loadSkyTexture } from '../lighting/skyEnvironment.js'

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
 * CRITICAL means "visible in, or lighting, the opening frame" — not "used by
 * the site." Act 3's world (billboard, highway, street lights, the night
 * sky) is absent from this list by design and stays behind
 * `CampaignsGate`, which fetches it on approach. The chapter videos are
 * absent too: their elements carry `preload = 'none'` and together they are
 * 60MB.
 *
 * The memoised promise is also what makes returning from /work, /about or
 * /contact cheap — the second call resolves immediately, so the gate opens on
 * the next frame instead of repeating a load the browser has already done.
 */

/**
 * The four models standing in the room. `billboard` and `streetLights` are
 * deliberately NOT here — see the note above.
 */
const CRITICAL_MODEL_URLS = [
  MODEL_URLS.camera,
  MODEL_URLS.cameraStand,
  MODEL_URLS.monitor,
  MODEL_URLS.pedestal,
]

/** Every surface the camera can see at progress 0 is one of these three sets. */
const CRITICAL_STONE_SETS = ['walls', 'floors', 'columns']

/** The MGRT inlay's own two maps, which have no set structure. */
const CRITICAL_TEXTURE_URLS = [...BRASS_URLS]

/**
 * A ceiling on how long the void may last.
 *
 * The gate is a quality improvement, not a dependency: if a file is slow or a
 * connection stalls, the visitor gets the room — progressive upgrades and all,
 * exactly as before this module existed — rather than an indefinite black
 * screen. Generous enough that it is never reached on a working connection.
 */
export const CRITICAL_ASSET_TIMEOUT_MS = 20000

/**
 * Warms one URL in the HTTP cache.
 *
 * A bare `fetch` is the right tool rather than a real loader: the goal is to
 * have the BYTES local, and the decode/parse/upload belongs to whichever
 * loader the scene itself uses moments later, which is also the only copy
 * that ends up resident. Decoding here as well would double the memory for
 * no gain. Failures resolve rather than reject — a missing texture must not
 * be able to hold the room hostage.
 */
function warm(url) {
  return fetch(url).then(
    (response) => response.arrayBuffer().catch(() => null),
    () => null,
  )
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

export function preloadCriticalAssets() {
  if (pending) return pending

  /*
   * Models go through R3F's own loader cache, not `warm`, and one URL per
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
     * Stone goes through `preloadScannedStone` rather than `warm`, and the
     * difference matters: `warm` only puts BYTES in the HTTP cache, leaving the
     * decode to whichever material asked first. This decodes each file once,
     * here, and keeps the `Texture`, which is what lets `createStoneWallMaterial`
     * build straight from the scan instead of generating a stand-in it would
     * only throw away. Same requests, same count — just finished properly.
     */
    ...CRITICAL_STONE_SETS.map(preloadScannedStone),
    ...CRITICAL_TEXTURE_URLS.map(warm),
  ]).then(() => {
    settled = true
  })

  return pending
}
