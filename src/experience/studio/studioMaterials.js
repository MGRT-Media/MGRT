import * as THREE from 'three'
import { cloneScannedMaps } from '../materials/scannedStone.js'
import { breakUpTiling } from './antiTiling.js'
import { applyWalnutBoards } from './walnutBoards.js'
import { LOOK } from './studioLook.js'

/**
 * The studio's surface materials, built from `LOOK`.
 *
 * Every map a material will ever have is in place when it is created: the
 * textures are decoded before the scene mounts (`studioAssets.js`), so nothing
 * is swapped in later and no program is recompiled after the reveal.
 */

/**
 * A scanned PBR surface. Geometry carries its UVs in metres, so the repeat is
 * simply one over the scan's size and the texture lands at real scale on
 * whatever it is applied to.
 */
function scannedMaterial({ set, tile, tint, roughness, normalScale }, options = {}) {
  const maps = cloneScannedMaps(set, 1 / tile, 1 / tile)
  const material = new THREE.MeshStandardMaterial({
    color: tint,
    roughness,
    metalness: 0,
    ...options,
  })
  // A set that failed to load leaves the surface in its flat tint.
  if (maps) {
    material.map = maps.map
    material.normalMap = maps.normalMap
    material.normalScale.setScalar(normalScale)
    material.roughnessMap = maps.ormMap
  }
  return material
}

export function createPlasterMaterial() {
  return breakUpTiling(scannedMaterial(LOOK.plaster, { vertexColors: true }), LOOK.plaster.patchScale)
}

export function createFloorMaterial() {
  return breakUpTiling(scannedMaterial(LOOK.floor, { vertexColors: true }), LOOK.floor.patchScale)
}

/**
 * Materials that mirror the room, with the light whose level their
 * reflections follow. A reflection is light too: left at full strength it
 * would make polished surfaces glow in a room that is still dark, so the
 * lighting rig scales each one with its stage (`StudioLightingRig.jsx`).
 */
export const reflective = new Set()

function reflectiveMaterial(material, environment, strength, follows) {
  material.envMap = environment
  material.envMapIntensity = 0
  const entry = { material, strength, follows }
  reflective.add(entry)
  material.addEventListener('dispose', () => reflective.delete(entry))
  return material
}

export function createWalnutMaterial(environment) {
  const material = applyWalnutBoards(scannedMaterial(LOOK.walnut, { vertexColors: true }))
  return reflectiveMaterial(material, environment, LOOK.walnut.reflections, 'tableKey')
}

export function createStoneMaterial(environment) {
  const material = breakUpTiling(scannedMaterial(LOOK.stone), LOOK.stone.patchScale)
  return reflectiveMaterial(material, environment, LOOK.stone.reflections, 'tableKey')
}

export function createSteelMaterial(environment) {
  const { color, roughness, metalness, reflections } = LOOK.steel
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness })
  return reflectiveMaterial(material, environment, reflections, 'tableKey')
}

export function createBronzeMaterial(environment) {
  const { color, roughness, metalness, reflections } = LOOK.bronze
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness })
  return reflectiveMaterial(material, environment, reflections, 'lettering')
}

export function createCeilingMaterial() {
  return new THREE.MeshStandardMaterial({ color: LOOK.ceiling, roughness: 1 })
}
