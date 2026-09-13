import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { createScreenVideoMaterial } from './screenVideoMaterial.js'
import {
  MODEL_URLS,
  cloneNode,
  measure,
  useDarkStateDimming,
  useModel,
  useTreatedMaterials,
} from '../models/modelAssets.js'
import { cameraProgress } from '../timeline/heroSequence.js'
import { MONITOR_SNAP_T, DIGITAL_IGNITE_RISE } from '../timeline/filmActBeats.js'
import { BEAM_CENTER, YAW_DEGREES, MONITOR_PLINTH } from './plinthAnchor.js'
import { assetUrl } from '../assets/assetUrl.js'
import { createStoneWallMaterial } from '../materials/stoneWallMaterial.js'
import { applyStoneMacroVariation } from '../materials/stoneMacroVariation.js'

// Phase 2: curated Digital work, per experience-design.md §8 ("approximately
// 2-4 selected Digital projects"). One clip for now — extending to a
// scroll-mapped sequence of several is future work, not part of this swap.
// Exported so FullscreenButton.jsx's modal CTA (§4BN) can play the same
// file directly, instead of hardcoding this path a second time.
export const DIGITAL_MEDIA_SRC = assetUrl('/media/digital/digital-01-website.mp4')

// How far before the true end of the clip playback seeks back to the
// start — see the seamless-loop comment in the useFrame below for why.
const LOOP_EARLY_SECONDS = 0.1

/**
 * Phase 2 Digital console — a retro/mid-century industrial reference-
 * monitor, back to standing on its own dedicated stone plinth (per
 * explicit request for separate stands rather than one shared plinth),
 * positioned directly beside the Cinema Camera's own plinth
 * (`CinemaCamera.jsx`) — both built around the same beam center/yaw
 * (`plinthAnchor.js`) so they read as a deliberate paired composition,
 * not two unrelated objects that happen to be nearby.
 *
 * `screenCenterHeight` is computed from the console's actual stacked
 * dimensions below (plinth height + housing offset), not hand-picked.
 */
const HOUSING = {
  width: 1.15,
  height: 0.85,
  frontDepth: 0.55,
  rearWidth: 0.8,
  rearHeight: 0.6,
  rearDepth: 0.42,
  cornerRadius: 0.05,
}

const BEZEL = {
  side: 0.13,
  top: 0.12,
  bottom: 0.22,
}

const housingCenterY = MONITOR_PLINTH.height + HOUSING.height / 2
const screenWidth = HOUSING.width - BEZEL.side * 2
const screenHeight = HOUSING.height - BEZEL.top - BEZEL.bottom
// Bottom bezel is deliberately taller (control-panel area), so the screen
// itself sits slightly above the housing's own vertical center.
const screenCenterOffset = (BEZEL.bottom - BEZEL.top) / 2
const screenCenterHeight = housingCenterY + screenCenterOffset

const screenFrontZ = HOUSING.frontDepth / 2 + 0.002
const glassFrontZ = screenFrontZ + 0.004

// The screen's real world-space position and facing direction, accounting
// for both the shared beam yaw AND this object's own plinth offset.
// `cameraPath.js`'s monitor-aligned shot derives its framing from these
// instead of hand-adjusted numbers.
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const yawRadians = THREE.MathUtils.degToRad(YAW_DEGREES)
const screenWorldPosition = new THREE.Vector3(MONITOR_PLINTH.offsetX, screenCenterHeight, screenFrontZ)
  .applyAxisAngle(Y_AXIS, yawRadians)
  .add(new THREE.Vector3(BEAM_CENTER[0], 0, BEAM_CENTER[2]))
const screenForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y_AXIS, yawRadians)

export const MONITOR_ANCHOR = {
  position: BEAM_CENTER,
  screenWidth,
  screenHeight,
  screenCenterHeight,
  screenWorldPosition: screenWorldPosition.toArray(),
  screenForward: screenForward.toArray(),
}

/**
 * `spark-computer.glb` — the Lumen 64 "Spark", a static computer with its
 * keyboard attached, optimised offline from the 29.2MB source to 1.9MB.
 *
 * What the production file is, and why:
 *
 *  - **Static.** The source's animation (gears, fans, a scrolling screen
 *    layer, ray effects) was baked at t = 0 and removed; this room's props
 *    do not move.
 *  - **Cut, after inspection at the real camera positions.** The animated
 *    screen layer and ray effects are gone, so nothing can overlap the
 *    display. The CPU gears and fans sat deep under glass and changed nothing
 *    even magnified. The trackball peripheral and its cable were removed:
 *    fitted to this screen height they would hang 0.54m off the pedestal in
 *    mid-air. The ornate cadence parts and the electrodes, which read through
 *    the glass, were simplified rather than removed.
 *  - **Hidden geometry removed** by rasterising the model from every position
 *    on the camera path (plus a margin), keeping a two-triangle ring around
 *    everything visible so no edge can open.
 *  - **Merged by material** into seven meshes, with duplicate UV sets
 *    collapsed onto one, textures re-encoded as WebP and geometry
 *    meshopt-compressed (the decoder is already wired in `modelAssets.js`).
 *
 * The screen is its own mesh with its own material, named `SparkScreen`, and
 * its UVs were remapped offline to the full frame — 0..1 across and up — so
 * the video needs no correction here.
 */
const MODEL_SCREEN_NODE = 'SparkScreen'

function useFittedMonitor() {
  const gltf = useModel(MODEL_URLS.monitor)

  return useMemo(() => {
    const holder = new THREE.Group()
    const parts = []
    gltf.scene.traverse((o) => {
      if (o.isMesh) parts.push(o)
    })
    if (!parts.length) return { holder, screenWidth, screenAspect: screenWidth / screenHeight, baseY: MONITOR_PLINTH.height, footprint: null }

    const shell = new THREE.Group()
    parts.forEach((part) => {
      part.updateWorldMatrix(true, false)
      const clone = part.clone(true)
      clone.matrix.copy(part.matrixWorld)
      clone.matrix.decompose(clone.position, clone.quaternion, clone.scale)
      clone.matrixAutoUpdate = true
      shell.add(clone)
    })
    holder.add(shell)
    const screen = shell.getObjectByName(MODEL_SCREEN_NODE)
    if (!screen) return { holder, screenWidth, screenAspect: screenWidth / screenHeight, baseY: MONITOR_PLINTH.height, footprint: null }

    // Turned so the screen faces +Z, this project's screen-forward convention —
    // measured from the screen's own geometry rather than assumed, since each
    // asset this slot has held faced a different way.
    holder.rotation.y = -screenFacingYaw(screen)

    const authored = measure(screen)
    holder.scale.setScalar(screenHeight / authored.size.y)

    const scaled = measure(screen)
    holder.position.x -= scaled.center.x
    holder.position.y += screenCenterHeight - scaled.center.y
    // Align the panel's FRONT face, not its centre — the panel has real
    // thickness, and the video plane has to sit just proud of the glass.
    holder.position.z += screenFrontZ - scaled.box.max.z
    holder.updateWorldMatrix(true, true)

    const fitted = measure(screen)
    const contact = contactFootprint(shell)
    return {
      holder,
      screen,
      screenWidth: fitted.size.x,
      screenAspect: fitted.size.x / fitted.size.y,
      baseY: contact.baseY,
      footprint: contact.footprint,
    }
  }, [gltf])
}

/** Height band above an object's lowest vertex that counts as touching what it stands on. */
const CONTACT_BAND = 0.015

/**
 * Where the computer actually touches its support: the extent of every vertex
 * within `CONTACT_BAND` of its base — the feet, not the overhanging case.
 *
 * Measured from vertices rather than bounding boxes. A box transformed by a
 * rotated node inflates, and this asset's parts arrive rotated, so a
 * box-based base came out 28cm too low.
 */
function contactFootprint(root) {
  const points = []
  const v = new THREE.Vector3()
  root.updateWorldMatrix(true, true)
  root.traverse((o) => {
    if (!o.isMesh) return
    const position = o.geometry.attributes.position
    for (let i = 0; i < position.count; i += 1) points.push(v.fromBufferAttribute(position, i).applyMatrix4(o.matrixWorld).clone())
  })
  const baseY = Math.min(...points.map((p) => p.y))
  const footprint = new THREE.Box3().setFromPoints(points.filter((p) => p.y < baseY + CONTACT_BAND))
  return { baseY, footprint }
}

/**
 * The yaw of the screen's facing direction, from its own vertex normals.
 * A flat panel's normals all agree, so their sum is its facing.
 */
function screenFacingYaw(screen) {
  const normal = screen.geometry.attributes.normal
  const sum = new THREE.Vector3()
  const n = new THREE.Vector3()
  screen.updateWorldMatrix(true, false)
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(screen.matrixWorld)
  for (let i = 0; i < normal.count; i += 1) sum.add(n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix))
  return Math.atan2(sum.x, sum.z)
}

/**
 * The stone pedestal (`digital-stone.glb`), fitted to whatever it carries.
 *
 * `topAt` is the computer's real base, so it lands ON the stone. The rock is
 * then sized and placed from the computer's contact `footprint` rather than
 * from a fixed width: the Spark computer's screen sits at the back of its lid
 * with the keyboard deck running 0.65m forward of it, so a pedestal centred
 * on the screen — as it was for the old monitor, whose screen was its front —
 * left most of the computer standing on nothing.
 *
 * The camera path pins the screen, so the computer cannot move or shrink to
 * suit the stone; the stone adapts instead. Its flat top is widened just
 * enough to carry the feet with `TOP_MARGIN` to spare, and only across its
 * width and depth — its height, and so its proportions from the room, keep
 * the scale the `MONITOR_PLINTH.width` fit always gave it. The floor-stone
 * projection runs after scaling, in metres, so widening never stretches the
 * texture.
 *
 * The rock is fitted by its real vertices, not by bounding boxes: its node
 * arrives rotated, and a rotated box inflates — which is what had left a 13mm
 * gap between the old monitor and the stone.
 */
const TOP_MARGIN = 0.03
const TOP_BAND = 0.03

function useStonePedestal(topAt, footprintWidth, footprint) {
  const gltf = useModel(MODEL_URLS.pedestal)

  return useMemo(() => {
    const group = new THREE.Group()
    const rock = cloneNode(gltf, 'Object_2')
    if (!rock) return group
    group.add(rock)

    // Unscaled vertices in the group's frame, and the flat top among them.
    const points = []
    const v = new THREE.Vector3()
    const position = rock.geometry.attributes.position
    rock.updateMatrix()
    for (let i = 0; i < position.count; i += 1) points.push(v.fromBufferAttribute(position, i).applyMatrix4(rock.matrix).clone())
    const all = new THREE.Box3().setFromPoints(points)
    const top = new THREE.Box3().setFromPoints(points.filter((p) => p.y > all.max.y - TOP_BAND * (all.max.x - all.min.x) / footprintWidth))

    // Height keeps the scale the fixed-width fit always gave; width and depth
    // grow only as far as the feet require.
    const base = footprintWidth / (all.max.x - all.min.x)
    const scale = new THREE.Vector3(base, base, base)
    if (footprint) {
      scale.x = Math.max(base, (footprint.max.x - footprint.min.x + TOP_MARGIN * 2) / (top.max.x - top.min.x))
      scale.z = Math.max(base, (footprint.max.z - footprint.min.z + TOP_MARGIN * 2) / (top.max.z - top.min.z))
    }
    group.scale.copy(scale)

    const topCentre = top.getCenter(new THREE.Vector3()).multiply(scale)
    const target = footprint ? footprint.getCenter(new THREE.Vector3()) : new THREE.Vector3()
    group.position.set(target.x - topCentre.x, topAt - all.max.y * scale.y, target.z - topCentre.z)

    // Re-skinned in the floor's own stone — see `projectFloorStone`.
    rock.geometry = projectFloorStone(rock.geometry, rock.matrix, scale)
    rock.material = createFloorStoneMaterial()
    rock.castShadow = true
    rock.receiveShadow = true
    return group
  }, [gltf, topAt, footprintWidth, footprint])
}

/**
 * Gives the pedestal UVs in real metres, projected per face.
 *
 * The asset's own UVs are an unwrap for its own texture, so the floor scan
 * laid across them would land at whatever scale that unwrap happened to have —
 * stretched in one place, pinched in another. Instead each triangle is
 * projected onto the local axis its face points along: the top takes X/Z, the
 * sides take their own horizontal axis against Y. In metres, which is the unit
 * the floor stone's density is expressed in (see `createFloorStoneMaterial`),
 * so a pebble on the pedestal is the same size as a pebble on the floor.
 *
 * Per face, which means the geometry is de-indexed first: a vertex shared
 * between a side and the top needs a different coordinate for each. The block
 * is cut stone — its faces measure 93% aligned with its own axes — so the
 * places the projection switches are its real edges, which is exactly where a
 * change of grain belongs on dressed stone.
 *
 * The small per-axis offsets stop adjacent faces showing the same patch of the
 * scan mirrored across a corner.
 *
 * Also bakes the floor's macro weathering into vertex colours, from the same
 * field and seed the floor uses, so both are cut from one quarry.
 */
const PROJECTION_OFFSETS = [
  [0.37, 1.13],
  [2.61, 0.52],
  [1.84, 3.07],
]

function projectFloorStone(sourceGeometry, nodeMatrix, scale) {
  const geometry = (sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone())
  const position = geometry.attributes.position
  const uv = new Float32Array(position.count * 2)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const edge = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const corners = [a, b, c]

  for (let v = 0; v < position.count; v += 3) {
    corners.forEach((corner, k) => {
      corner.fromBufferAttribute(position, v + k).applyMatrix4(nodeMatrix).multiply(scale)
    })
    normal.subVectors(c, b).cross(edge.subVectors(a, b))
    const ax = Math.abs(normal.x)
    const ay = Math.abs(normal.y)
    const az = Math.abs(normal.z)
    const axis = ay >= ax && ay >= az ? 1 : ax >= az ? 0 : 2
    const [offsetU, offsetV] = PROJECTION_OFFSETS[axis]

    corners.forEach((corner, k) => {
      const [u, w] = axis === 1 ? [corner.x, corner.z] : axis === 0 ? [corner.z, corner.y] : [corner.x, corner.y]
      uv[(v + k) * 2] = u + offsetU
      uv[(v + k) * 2 + 1] = w + offsetV
    })
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))

  const scratch = new THREE.Vector3()
  applyStoneMacroVariation(geometry, {
    seed: 31,
    toWorld: (x, y, z) => scratch.set(x, y, z).applyMatrix4(nodeMatrix).multiply(scale).toArray(),
  })
  return geometry
}

/**
 * The floor's material, not a lookalike: same scanned set, same tint, same
 * normal strength, same weathering, and the same PBR path — including the
 * scene environment the floor receives, which `useTreatedMaterials` would
 * otherwise switch off.
 *
 * The repeat is the floor-debris convention (`Environment.jsx`): UVs in metres,
 * passed as `1 / TILE_SIZE`, which `createStoneWallMaterial` turns into exactly
 * the floor plane's texel density.
 */
function createFloorStoneMaterial() {
  const material = createStoneWallMaterial('#b0aca4', [1 / 1.4, 1 / 1.4], [0.8, 0.8], { scanned: 'floors' })
  material.vertexColors = true
  return material
}

/** Matte painted-industrial finish, matching the casing this replaces. */
function casingTreatment(material) {
  material.roughness = Math.max(material.roughness ?? 1, 0.72)
  material.metalness = Math.min(material.metalness ?? 0, 0.15)
  if (material.color) material.color.multiplyScalar(0.45)
}

export default function Monitor() {
  // A plain <video> element (not React state) driving a THREE.VideoTexture
  // — muted/playsInline/loop so autoplay is permitted and the clip repeats
  // for as long as the camera stays locked on the monitor. THREE calls
  // texture.update() on VideoTexture instances automatically every render,
  // so no manual per-frame refresh is needed here.
  const video = useMemo(() => {
    const el = document.createElement('video')
    el.src = DIGITAL_MEDIA_SRC
    el.loop = true
    el.muted = true
    el.playsInline = true
    // 'auto' -> 'none'. At 'auto' the browser began pulling this clip the
    // instant the element was created, so ~60MB of placeholder video competed
    // with the models and textures the opening frame actually needs. Nothing
    // is fetched now until `play()` is called at the beat that uses it.
    //
    // Tradeoff, deliberately taken: the first frames have to buffer when that
    // beat arrives instead of being ready in advance. The loop logic already
    // guards on `video.duration`, which is NaN until metadata loads, so this
    // is safe — but if the stall shows once the clips are final, 'metadata'
    // (headers only, a few KB) or an explicit `load()` shortly before the beat
    // are the two ways to buy the head start back without paying for it up front.
    el.preload = 'none'
    return el
  }, [])
  const videoTexture = useMemo(() => new THREE.VideoTexture(video), [video])
  // `coverTransmittance` is what the glass pane below leaves of this screen,
  // measured off a flat test colour rendered through it (0.76 of the value
  // the shader writes). It exists only so the Campaigns billboard's copy of
  // this screen matches the direct view — see `screenVideoMaterial.js`. If
  // the glass's opacity or colour changes, re-measure it.
  const screenMaterial = useMemo(
    () =>
      createScreenVideoMaterial(videoTexture, screenWidth / screenHeight, {
        coverTransmittance: 1,
      }),
    [videoTexture],
  )

  // The material starts with a reasonable 16:9 default (screenVideoMaterial.js)
  // since the video's real dimensions aren't known synchronously; update
  // once they are so the cover-fit crop is exact rather than approximate.
  useEffect(() => {
    const onLoadedMetadata = () => {
      screenMaterial.uniforms.uVideoAspect.value = video.videoWidth / video.videoHeight
    }
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    return () => video.removeEventListener('loadedmetadata', onLoadedMetadata)
  }, [video, screenMaterial])

  // Media playback follows technical-architecture.md §11: prepared/played
  // only once the camera actually reaches the monitor, paused and reset
  // once it leaves — not tied to raw DOM visibility, and not left playing
  // for the whole experience. `.play()` is wrapped since it returns a
  // promise that can reject (e.g. a not-yet-ready decode); a failed
  // playback attempt must not break the cinematic timeline (§11 "Media
  // fallback"). `wasPlaying` is a plain ref, not React state, purely to
  // detect the play/pause edge each frame.
  const wasPlaying = useRef(false)

  useEffect(() => () => video.pause(), [video])

  // Ignite is a pure function of the camera's progress along the path
  // (`cameraProgress`, not raw scroll, so the screen lights in step with the
  // camera's own approach rather than ahead of it) — a smoothstep ramp into
  // MONITOR_SNAP_T, the same mechanism CinemaCamera.jsx already uses for
  // its own lens screen, rather than an onCameraLock event damped over
  // real time (the previous approach here). This is what makes the
  // Film<->Digital transition genuinely reversible: the exact same ignite
  // level shows at a given progress value regardless of how fast, or in
  // which direction, the visitor scrolled to reach it.
  useFrame(() => {
    const p = cameraProgress.value
    const ignite = THREE.MathUtils.smoothstep(p, MONITOR_SNAP_T - DIGITAL_IGNITE_RISE, MONITOR_SNAP_T)
    screenMaterial.uniforms.uIgnite.value = ignite

    const shouldPlay = ignite > 0.02
    if (shouldPlay && !wasPlaying.current) {
      video.currentTime = 0
      video.play().catch(() => {})
    } else if (!shouldPlay && wasPlaying.current) {
      video.pause()
    }
    wasPlaying.current = shouldPlay

    // Seamless loop: per explicit report of a black flash on the native
    // `loop` restart — browsers commonly show a brief empty/black frame
    // right at end-of-stream while the decoder resets for the jump back
    // to the start, since that reset is a real decode boundary, not
    // just a UI transition. Checked every rendered frame (far finer-
    // grained than the browser's own throttled `timeupdate` event, which
    // can fire as infrequently as ~4x/second — too coarse to reliably
    // land inside a sub-200ms window), so the seek back to `0` happens
    // shortly BEFORE the true end, and playback never actually reaches
    // end-of-stream in the first place. Seeking to `0` itself is cheap
    // and clean (encoders start files on a keyframe, so there's no
    // forward-decode needed), unlike the wrap-around the native `loop`
    // attribute performs. `el.loop = true` is left in place as a harmless
    // fallback in case this early seek is ever missed on a slow frame.
    if (shouldPlay && video.duration && video.currentTime >= video.duration - LOOP_EARLY_SECONDS) {
      video.currentTime = 0
    }
  })

  const model = useFittedMonitor()

  // The video goes on the model's own screen, which carries full-frame UVs
  // from the offline pass. Its cover-fit target is the screen's MEASURED
  // aspect (1.59), so a 16:9 clip is cropped a little at the sides rather than
  // stretched — never letterboxed into a visible border.
  useEffect(() => {
    if (!model.screen) return
    screenMaterial.name = 'SparkScreenVideo'
    screenMaterial.uniforms.uTargetAspect.value = model.screenAspect
    model.screen.material = screenMaterial
  }, [model.screen, model.screenAspect, screenMaterial])
  const pedestal = useStonePedestal(model.baseY, MONITOR_PLINTH.width, model.footprint)

  // The downloaded housing and the stone both arrive lit for someone
  // else's scene. Knocking the albedo down and the roughness up puts them
  // in the same night interior as the walls and columns beside them,
  // rather than reading as brighter objects pasted into it.
  useTreatedMaterials(model.holder, casingTreatment)
  // The pedestal is deliberately NOT treated or dimmed any more. Both existed
  // to pull a foreign asset's own texture into line with the room; it is now
  // built from the floor's own material, and any per-prop adjustment would
  // make it the one piece of floor stone that lights differently from the
  // floor it stands on.

  // Dark-state only: at progress 0 the housing and its plinth were the
  // brightest things in the frame, reading before the architecture. These
  // release back to the treated values above as the room ignites, so the
  // monitor close-up later in the sequence is untouched.
  useDarkStateDimming(model.holder, 0.5)

  return (
    <group position={BEAM_CENTER} rotation={[0, yawRadians, 0]}>
      <group position={[MONITOR_PLINTH.offsetX, 0, 0]}>
        {/* Stone pedestal (digital-stone.glb), replacing the procedural
            rock. Its top is placed to meet the housing's real base rather
            than a fixed height — see `useFittedMonitor`. */}
        <primitive object={pedestal} />

        {/* The computer (spark-computer.glb), fitted to the existing screen
            anchor so `cameraPath.js` still frames what it was authored to. */}
        <primitive object={model.holder} />

        {/* No separate screen plane and no glass pane: the video is on the
            model's own screen mesh, so `coverTransmittance` is 1 — there is no
            pane in front of the image to attenuate it. */}
      </group>
    </group>
  )
}
