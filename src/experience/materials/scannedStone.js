import * as THREE from 'three'
import { assetUrl } from '../assets/assetUrl.js'

/**
 * The scanned stone sets: loaded once, shared by every material that uses them.
 *
 * This exists as its own module for two reasons. It is the boundary between
 * `criticalAssets.js` (which decides WHEN these load) and `stoneWallMaterial.js`
 * (which decides HOW they are used), and importing either from the other would
 * close a cycle — the same trap that produced this project's
 * `PILLAR_RING_RADIUS` initialisation bug. And it is the thing that makes a
 * direct scanned material possible at all: a material can only be built
 * straight from a scan if the scan is already decoded and resident, which is
 * what this cache guarantees once `preloadScannedStone` has resolved.
 *
 * It also fixes a quieter waste. The previous path created a new
 * `TextureLoader` and a new `Texture` per material per slot — seven materials
 * across three sets, so nine files were decoded and uploaded twenty-one times.
 * Here each file is decoded once; materials take `clone()`s, which share the
 * underlying `Source` and therefore the decode and the GPU upload, and differ
 * only in the `repeat` each surface needs.
 */

export const SCANNED_BASE = '/textures'

/**
 * Three files per set, not four, and WebP rather than JPEG.
 *
 * `MeshStandardMaterial` samples `aoMap` from the red channel and
 * `roughnessMap` from the green one, so a single ORM texture can fill both
 * slots. Packing them halves the requests and the GPU memory for that pair —
 * an uploaded texture costs the same VRAM whatever its file format, so
 * dropping a whole texture is the only thing that actually reduces it.
 */
export const SCANNED_SLOTS = [
  { key: 'map', file: 'albedo.webp', colorSpace: THREE.SRGBColorSpace },
  { key: 'normalMap', file: 'normal.webp' },
  { key: 'ormMap', file: 'orm.webp' },
]

/**
 * World size of one scanned tile, in units.
 *
 * Deliberately NOT the generated material's `TILE_SIZE`. The generated texture
 * is a single dressed block with mortar around its border, so tiling it once
 * per 1.4 units is exactly what draws the coursing. A scanned set is a
 * photograph of a large slab of rock, and repeating that every 1.4 units turns
 * the room into wallpaper.
 */
export const SCANNED_TILE_SIZE = 4.2

export function scannedStoneUrls(set) {
  // Through `assetUrl` because these paths are assembled at runtime from the
  // set name — no build-time rewrite could reach them.
  return SCANNED_SLOTS.map(({ file }) => assetUrl(`${SCANNED_BASE}/${set}/${file}`))
}

/** set -> { map, normalMap, ormMap } once every file is decoded, else null. */
const decoded = new Map()
const inFlight = new Map()

/**
 * Resolves `null` rather than rejecting on any failure, including the case
 * this project actually hits: a dev server that answers a missing path with
 * the SPA's `index.html` and a 200. No content-type probe is needed to catch
 * that — an HTML document handed to the image decoder simply fails to decode,
 * which lands here. That removes the three extra probe requests the previous
 * implementation made.
 */
function loadTexture(url) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(url, resolve, undefined, () => resolve(null))
  })
}

/**
 * Loads one set. Idempotent and memoised, so `criticalAssets`'s preflight and
 * any later caller share a single decode.
 *
 * Resolves `true` only when ALL THREE maps decoded. Partial sets resolve
 * `false` and leave the caller on the procedural path — a material with a
 * scanned albedo but a generated roughness is a worse material than either
 * done consistently, and the all-or-nothing rule keeps the fallback simple
 * enough to reason about.
 */
export function preloadScannedStone(set) {
  if (!inFlight.has(set)) {
    inFlight.set(
      set,
      Promise.all(scannedStoneUrls(set).map(loadTexture)).then((textures) => {
        if (textures.some((texture) => !texture)) {
          textures.forEach((texture) => texture?.dispose())
          decoded.set(set, null)
          return false
        }
        const maps = {}
        SCANNED_SLOTS.forEach(({ key }, index) => {
          maps[key] = textures[index]
        })
        decoded.set(set, maps)
        return true
      }),
    )
  }
  return inFlight.get(set)
}

/**
 * The synchronous readiness signal. `null` means "not resident" — either not
 * preloaded yet, or genuinely unavailable — and callers must take the
 * procedural path in both cases.
 */
export function scannedStoneReady(set) {
  return decoded.get(set) ?? null
}

/**
 * Per-material copies at the repeat that surface needs.
 *
 * `clone()` rather than a fresh load: a cloned texture shares its `Source`
 * with the original, so the image is decoded once and uploaded to the GPU
 * once however many surfaces use it, while `repeat` — the only thing that
 * differs between them — stays per-material.
 */
export function cloneScannedMaps(set, repeatU, repeatV) {
  const source = scannedStoneReady(set)
  if (!source) return null

  const maps = {}
  SCANNED_SLOTS.forEach(({ key, colorSpace }) => {
    const texture = source[key].clone()
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatU, repeatV)
    // Colour data is sRGB; normal, roughness and occlusion are measurements
    // and must stay linear or the lighting maths is fed gamma-encoded values.
    texture.colorSpace = colorSpace ?? THREE.NoColorSpace
    texture.anisotropy = 8
    texture.needsUpdate = true
    maps[key] = texture
  })
  // three reads aoMap from uv1 by default; none of this room's geometry
  // carries a second UV set, so point it at uv0.
  maps.ormMap.channel = 0
  return maps
}
