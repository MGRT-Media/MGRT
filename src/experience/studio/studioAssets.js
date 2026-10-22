import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { assetUrl } from '../assets/assetUrl.js'
import { preloadScannedStone } from '../materials/scannedStone.js'
import { LOOK } from './studioLook.js'

/**
 * Everything the studio's opening frame needs, fetched and decoded before the
 * scene mounts — the same contract as the original scene's preflight
 * (`loading/criticalAssets.js`), so nothing appears or changes after the reveal.
 *
 * Textures go through the existing loader, which decodes them off the main
 * thread and keeps one decoded copy per set. Nothing here rejects: a file that
 * fails leaves its surface in a flat tone rather than stopping the page.
 */
const TEXTURE_SETS = [LOOK.plaster.set, LOOK[LOOK.tableFinish].set, LOOK.floor.set]

const LETTERING_URL = assetUrl('/models/studio/wall-lettering.glb')

const loaded = { letteringGeometry: null }
let pending = null
let settled = false

export function studioAssetsSettled() {
  return settled
}

/** The wall lettering's geometry, or null if its file did not load. */
export function letteringGeometry() {
  return loaded.letteringGeometry
}

export function preloadStudioAssets() {
  if (pending) return pending
  const lettering = new GLTFLoader()
    .loadAsync(LETTERING_URL)
    .then((gltf) => {
      loaded.letteringGeometry = gltf.scene.getObjectByProperty('isMesh', true)?.geometry ?? null
    })
    .catch((error) => console.warn('[studioAssets] wall lettering failed to load:', error?.message ?? error))

  pending = Promise.all([...TEXTURE_SETS.map(preloadScannedStone), lettering]).then(() => {
    settled = true
  })
  return pending
}
