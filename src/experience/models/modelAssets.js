import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { IGNITE_START, IGNITE_END } from '../lighting/VolumetricLightingRig.jsx'

/**
 * Every downloaded model asset, in one place.
 *
 * All six are served from `public/models/` as static files, so they are
 * fetched on demand and never enter the JS bundle. Each was optimised
 * before being committed rather than shipped as downloaded — the raw set
 * was 57MB, which no scroll-driven experience can justify. See
 * `docs/build-status.md` for the per-file figures; the short version is
 * texture recompression to WebP at 1024, mesh simplification on the two
 * heaviest, and — for the vehicles — extracting the three needed models
 * out of a 43-vehicle FBX layout and converting them to a single GLB, so
 * the runtime loads one 1.4MB file with `GLTFLoader` instead of a 7.3MB
 * FBX and a second loader.
 */
export const MODEL_URLS = {
  camera: '/models/camera/film-camera.glb',
  monitor: '/models/monitor/digital-monitor.glb',
  pedestal: '/models/pedestal/digital-stone.glb',
  billboard: '/models/billboard/campaign-billboard.glb',
  vehicles: '/models/vehicles/vehicles.glb',
  streetLights: '/models/streetlights/street-lights.glb',
}

/**
 * Loads a GLB through `GLTFLoader`. `useLoader` caches by URL across every
 * caller and suspends until ready, so a model used in two places is
 * fetched, parsed and uploaded exactly once.
 */
export function useModel(url) {
  return useLoader(GLTFLoader, url)
}

/** Warms the cache so a model is not first requested at the moment it is needed. */
export function preloadModels() {
  Object.values(MODEL_URLS).forEach((url) => useLoader.preload(GLTFLoader, url))
}

/**
 * Pulls one named node out of a loaded GLB and returns a clone of it.
 *
 * Cloning matters: `useLoader`'s cache hands every caller the SAME object
 * graph, so adding the loaded node straight into the scene would move it
 * out of any other caller's tree and make the second usage silently
 * disappear. Geometries and materials are shared by the clone rather than
 * duplicated, which is the point — the GPU upload happens once.
 */
export function cloneNode(gltf, name) {
  const source = gltf.scene.getObjectByName(name)
  if (!source) {
    console.warn(`[modelAssets] node "${name}" not found. Available:`,
      gltf.scene.children.flatMap((c) => [c.name, ...c.children.map((g) => g.name)]).filter(Boolean))
    return null
  }
  // Bake the node's WORLD transform into the clone's own local transform.
  // `clone()` copies a node's local transform only, and these assets all
  // arrive nested under exporter wrappers carrying the real scale and
  // rotation — a Sketchfab FBX conversion typically has two or three. Clone
  // the leaf alone and you get geometry at raw authoring scale in the wrong
  // orientation, which renders as either nothing visible or something
  // enormous, with no error to say why.
  source.updateWorldMatrix(true, false)
  const clone = source.clone(true)
  clone.matrix.copy(source.matrixWorld)
  clone.matrix.decompose(clone.position, clone.quaternion, clone.scale)
  clone.matrixAutoUpdate = true
  return clone
}

/**
 * Reads a node's world-space bounding box, having first detached it from
 * whatever parent transform the exporter left on it.
 *
 * Every one of these assets arrives with its own arbitrary authoring
 * transform — Sketchfab's FBX conversions in particular nest the model
 * under a chain of scaled, rotated wrappers — so a node's local geometry
 * bounds say nothing about the size it will actually render at. Measuring
 * after `updateWorldMatrix` is the only figure worth fitting against.
 */
export function measure(node) {
  node.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(node)
  return {
    box,
    size: box.getSize(new THREE.Vector3()),
    center: box.getCenter(new THREE.Vector3()),
  }
}

/**
 * A hook that returns a group containing the named nodes, uniformly scaled
 * and translated so the result occupies a known place in this scene.
 *
 * `fit` is where every model is reconciled with the geometry this project
 * already had, and it is deliberately expressed as "make this measurement
 * come out at this value" rather than as a magic scale number: the scene's
 * own constants (plinth height, lens radius, screen height) stay the
 * source of truth, and the model is fitted to them. That is what keeps the
 * camera path — which derives its keyframes from those same constants —
 * valid without being touched.
 */
export function useFittedModel(url, { nodes, fitWidth, fitHeight, topAt, centerXZ = true, rotationY = 0 }) {
  const gltf = useModel(url)

  return useMemo(() => {
    const group = new THREE.Group()
    const picked = (Array.isArray(nodes) ? nodes : [nodes])
      .map((name) => cloneNode(gltf, name))
      .filter(Boolean)
    if (!picked.length) return group

    const holder = new THREE.Group()
    picked.forEach((n) => holder.add(n))
    // Bake the authoring transform down before measuring, so the numbers
    // below are in the units this scene actually uses.
    const before = measure(holder)

    let scale = 1
    if (fitWidth) scale = fitWidth / before.size.x
    else if (fitHeight) scale = fitHeight / before.size.y
    holder.scale.setScalar(scale)

    const after = measure(holder)
    holder.position.x -= centerXZ ? after.center.x : 0
    holder.position.z -= centerXZ ? after.center.z : 0
    if (topAt !== undefined) holder.position.y += topAt - after.box.max.y
    holder.rotation.y = rotationY

    group.add(holder)
    return group
  }, [gltf, nodes, fitWidth, fitHeight, topAt, centerXZ, rotationY])
}

/**
 * Applies a visual treatment to every material in a subtree.
 *
 * These models arrive lit for whatever scene they were authored in, which
 * is never this one — a night interior lit by a single shaft. Left alone
 * they read as brighter, flatter and more saturated than everything around
 * them. This is also where `envMapIntensity` gets zeroed: several carry
 * one, and an environment map this scene does not have would otherwise
 * light them from nowhere.
 */
export function useTreatedMaterials(root, treat) {
  useLayoutEffect(() => {
    if (!root) return
    const seen = new Set()
    root.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if (!material || seen.has(material.uuid)) return
        seen.add(material.uuid)
        material.envMapIntensity = 0
        treat?.(material, object)
        material.needsUpdate = true
      })
    })
  }, [root, treat])
}

/**
 * Scroll-coupled dimming for a model's own materials during the room's
 * dark state, and only during it.
 *
 * `useTreatedMaterials` above already knocks these models' albedo down to
 * match the night interior, but that is one fixed value for the whole
 * sequence. Once the dark-state ambient/fill were raised so the
 * architecture reads at progress 0, the foreground props — housing,
 * plinth, camera body — caught that lift too and became the frame's
 * brightest elements, which inverts the intended reading order (space
 * first, objects last).
 *
 * Lowering their albedo outright would fix progress 0 by permanently
 * darkening them, including in the close-ups where each one is the
 * subject. So this scales the treated colour by `darkScale` at ignition 0
 * and releases it back to exactly the treated value as the room ignites,
 * riding the *same* `IGNITE_START`/`IGNITE_END` ramp as the lighting rig
 * rather than a second copy of those numbers that could drift. Direct
 * per-frame mutation, never React state, per technical-architecture.md §7.
 *
 * Call this *after* `useTreatedMaterials` on the same root: it captures
 * each material's colour as its baseline, and that baseline has to be the
 * post-treatment value.
 */
export function useDarkStateDimming(root, darkScale) {
  const tracked = useRef([])

  useLayoutEffect(() => {
    if (!root) return undefined
    const seen = new Set()
    const collected = []
    root.traverse((object) => {
      if (!object.isMesh) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if (!material?.color || seen.has(material.uuid)) return
        seen.add(material.uuid)
        collected.push({ material, base: material.color.clone() })
      })
    })
    tracked.current = collected
    // Restore on unmount: these materials can be shared with a cached GLTF
    // that outlives this component, so leaving them scaled would leak a
    // dimmed copy into whatever mounts next.
    return () => {
      collected.forEach(({ material, base }) => material.color.copy(base))
      tracked.current = []
    }
  }, [root])

  useFrame(() => {
    const ignite = THREE.MathUtils.smoothstep(scrollProgress.value, IGNITE_START, IGNITE_END)
    const scale = THREE.MathUtils.lerp(darkScale, 1, ignite)
    tracked.current.forEach(({ material, base }) => {
      material.color.copy(base).multiplyScalar(scale)
    })
  })
}
