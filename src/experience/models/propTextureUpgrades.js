import * as THREE from 'three'
import { assetUrl } from '../assets/assetUrl.js'
import { PROP_TEXTURE_MANIFEST } from './propTextureManifest.js'

/**
 * Installs each prop's full-resolution maps over the ones its GLB shipped with.
 *
 * The models arrive with 256px textures because that is all the opening
 * composition can resolve — the film camera is about 3% of the frame's width
 * and the monitor is forty pixels across (see `scripts/build-prop-assets.mjs`).
 * Their real maps are separate files, fetched once the room is on screen and
 * installed while the model is still small, so the close-ups at
 * `FILM_FOCUS_T` and `MONITOR_SNAP_T` are drawn at full resolution and the
 * visitor never watches the change happen.
 *
 * **Why this can be invisible at all.** The boot and full images differ by
 * less than two runs of the capture harness differ from each other at every
 * composition before the close-up — measured, not assumed. So there is no
 * "safe moment" to hunt for: any frame before the approach is one where the
 * swap cannot be seen, and the queue in `deferredAssets.js` is arranged so
 * that is where it lands.
 *
 * **One-way.** Once a model is upgraded it stays upgraded for the session.
 * Back-scrolling, direct navigation and returning from an internal page all
 * find the full-resolution maps, because the materials they find are the same
 * objects — `cloneNode` shares materials with the cached GLTF, so installing
 * here reaches every copy in the scene.
 *
 * **No shader recompilation.** Every slot upgraded here already has a texture
 * in it, so the material's program is unchanged and only a uniform points
 * somewhere new. Replacing a null slot would have meant a recompile — a
 * visible hitch — which is one more reason the boot maps exist rather than
 * shipping the models bare.
 */

/** model key -> the materials in the scene that belong to it. */
const registries = new Map()
/** model key -> { materialName: { property: THREE.Texture } }, once installed. */
const installed = new Map()
/** model key -> the in-flight upgrade, so it runs at most once. */
const running = new Map()

/**
 * The renderer, for `initTexture`. Set by `SceneReady`, which owns the moment
 * the scene is complete; the upgrades themselves are driven from
 * `deferredAssets.js` and from section flights, neither of which is inside the
 * canvas.
 */
let renderer = null

export function setUpgradeRenderer(gl) {
  renderer = gl
}

function materialsFor(key) {
  let set = registries.get(key)
  if (!set) {
    set = new Set()
    registries.set(key, set)
  }
  return set
}

/** Applies whatever has already been installed for `key` to one material. */
function applyInstalled(key, material) {
  const byMaterial = installed.get(key)
  const textures = byMaterial?.[material.name]
  if (!textures) return
  for (const [property, texture] of Object.entries(textures)) material[property] = texture
}

/**
 * Registers a model's materials, so an upgrade can find them.
 *
 * Called from the prop components with the subtree they built. Materials are
 * shared between clones, so the set deduplicates; a material registered after
 * its model was already upgraded (a remount) is brought up to date on the spot
 * rather than waiting for an upgrade that has already happened.
 */
export function registerPropMaterials(key, root) {
  if (!root || !PROP_TEXTURE_MANIFEST[key]) return undefined
  const set = materialsFor(key)
  const added = []
  root.traverse((object) => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!material?.name || set.has(material)) continue
      set.add(material)
      added.push(material)
      applyInstalled(key, material)
    }
  })
  return () => {
    for (const material of added) set.delete(material)
  }
}

/**
 * Builds a full-resolution texture that differs from the one it replaces in
 * nothing but its pixels.
 *
 * Cloned from the boot texture rather than constructed, so wrapping, repeat,
 * offset, filtering, anisotropy, colour space, `flipY` and the UV channel are
 * carried over by definition instead of by a list of properties someone has to
 * keep in step with `GLTFLoader`. Only the image is new — and it has to be a
 * new `Source`, because a clone shares the original's.
 */
function upgradedTexture(boot, image) {
  const texture = boot.clone()
  texture.source = new THREE.Source(image)
  texture.needsUpdate = true
  return texture
}

async function fetchImage(url) {
  const response = await fetch(assetUrl(url))
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.blob()
}

/**
 * The upgrade's phases, as `performance` marks.
 *
 * Download, decode, upload and swap are separate steps here rather than one
 * awaited expression precisely so each can be seen: what matters about this
 * system is not that it finishes but that it finishes with margin to spare
 * before the close-up that needs it, and that is only knowable if the phases
 * are on the timeline. Cheap enough to leave in the production build, where it
 * is the only way to check the margin on a real connection.
 */
const mark = (key, phase) => performance.mark(`prop:${key}:${phase}`)

/** Hands the main thread back so an upload does not share a frame with the next. */
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))

/**
 * Downloads, decodes, uploads and then installs one model's full-resolution
 * maps. Resolves when they are on the materials; safe to call repeatedly.
 */
export function upgradePropTextures(key) {
  const existing = running.get(key)
  if (existing) return existing

  const manifest = PROP_TEXTURE_MANIFEST[key]
  if (!manifest || !renderer) return Promise.resolve()

  const work = (async () => {
    // One fetch per FILE: a material's metalness and roughness are the same
    // glTF texture, so they name the same URL and must end up sharing one
    // upgraded texture, exactly as they shared one boot texture.
    const byUrl = new Map()
    for (const [materialName, properties] of Object.entries(manifest)) {
      for (const [property, url] of Object.entries(properties)) {
        if (!byUrl.has(url)) byUrl.set(url, { blob: null, image: null })
      }
    }
    mark(key, 'start')
    await Promise.all(
      Array.from(byUrl.entries(), async ([url, entry]) => {
        entry.blob = await fetchImage(url)
      }),
    )
    mark(key, 'downloaded')
    // Decoded off the main thread, which is the whole reason for the blob
    // step: these are 1024px maps and the opening is still animating.
    await Promise.all(
      Array.from(byUrl.values(), async (entry) => {
        entry.image = await createImageBitmap(entry.blob, { premultiplyAlpha: 'none' })
        entry.blob = null
      }),
    )
    mark(key, 'decoded')

    const materials = materialsFor(key)
    const byMaterial = {}
    const textures = new Map()
    for (const [materialName, properties] of Object.entries(manifest)) {
      // The boot texture to inherit settings from lives on a material in the
      // scene; without one there is nothing to upgrade yet.
      const material = Array.from(materials).find((candidate) => candidate.name === materialName)
      if (!material) continue
      for (const [property, url] of Object.entries(properties)) {
        const boot = material[property]
        const image = byUrl.get(url)?.image
        if (!boot || !image) continue
        let texture = textures.get(url)
        if (!texture) {
          texture = upgradedTexture(boot, image)
          textures.set(url, texture)
        }
        byMaterial[materialName] = byMaterial[materialName] ?? {}
        byMaterial[materialName][property] = texture
      }
    }

    // On the GPU before any material points at one, so the frame that first
    // shows them is not also the frame that uploads them — but ONE PER FRAME.
    // A 1024px map costs a few milliseconds to upload and this model has six
    // of them: sending the lot in a single callback put a 170ms frame right
    // where the room is quietly waiting to be scrolled, which is a worse fault
    // than the pop-in this whole system exists to avoid.
    for (const texture of textures.values()) {
      await nextFrame()
      renderer.initTexture(texture)
    }

    mark(key, 'uploaded')
    installed.set(key, byMaterial)

    // The swap itself: reference assignments only, no recompilation, no upload.
    const replaced = new Set()
    for (const material of materials) {
      const forMaterial = byMaterial[material.name]
      if (!forMaterial) continue
      for (const [property, texture] of Object.entries(forMaterial)) {
        if (material[property] && material[property] !== texture) replaced.add(material[property])
        material[property] = texture
      }
    }

    mark(key, 'swapped')

    // A frame later, once nothing is drawing from them any more.
    requestAnimationFrame(() => {
      for (const texture of replaced) texture.dispose()
    })
  })().catch(() => {
    // The boot maps are a complete, correct set. A failed upgrade leaves the
    // room exactly as it was and lets a later call try again.
    running.delete(key)
  })

  running.set(key, work)
  return work
}

/**
 * Resolves once `key` is at full resolution, starting the upgrade if it has
 * not begun.
 *
 * This is what a jump straight to a section waits on: the deferred queue
 * normally has the maps installed long before the camera gets near a close-up,
 * but a visitor who clicks a section mark seconds after the reveal on a slow
 * connection can outrun it, and a close-up must never be the thing that shows
 * a boot texture.
 */
export function propTexturesReady(key) {
  if (!PROP_TEXTURE_MANIFEST[key] || !renderer) return Promise.resolve()
  if (installed.has(key)) return Promise.resolve()
  return upgradePropTextures(key)
}

/** True once `key`'s full-resolution maps are on its materials. */
export function propTexturesInstalled(key) {
  return !PROP_TEXTURE_MANIFEST[key] || installed.has(key)
}

/** A remount rebuilds the scene; the installed textures outlive it in the GLTF cache. */
export function resetPropRegistries() {
  registries.clear()
}
