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
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { MONITOR_SNAP_T, DIGITAL_IGNITE_RISE } from '../timeline/filmActBeats.js'
import { BEAM_CENTER, YAW_DEGREES, MONITOR_PLINTH } from './plinthAnchor.js'
import { assetUrl } from '../assets/assetUrl.js'

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
 * Names of the two nodes taken from `digital-monitor.glb`. The file is a
 * whole computer desk — two machines, two keyboards, a render-view plane —
 * so this deliberately takes one machine's housing and its screen panel and
 * leaves the rest, rather than dropping the whole set into a room that
 * needs a single monitor on a plinth.
 */
/**
 * `old_computer_monitor_and_tv_model.glb`, optimised (533KB as downloaded to
 * 160KB, 3.9k triangles).
 *
 * The one thing that made this the right asset: it has a real `Display` mesh,
 * separate from the housing. The terminal it replaces did not, which forced
 * the fit to be derived from a bounding box and left no reliable way to know
 * the video plane was landing on the bezel rather than near it. With a named
 * panel, the housing can once again be aligned so that panel sits exactly on
 * `screenFrontZ` at `screenCenterHeight` — the constants `MONITOR_ANCHOR`,
 * `cameraPath.js` and `DepthOfField` are all built from.
 *
 * A 107x107-unit Sketchfab ground plane was removed from the file; it was the
 * only reason the asset's bounds were enormous, and it would have rendered a
 * second floor straight through the room's own.
 */
const MODEL_SCREEN_NODE = 'Display_Display_0'
const MODEL_EXCLUDE = /^(Display_Display_0|Plane_Ground_0)$/

/**
 * Fits the downloaded housing to the screen anchor this project already
 * had, rather than the other way round.
 *
 * `MONITOR_ANCHOR.screenHeight` is not a decoration: `cameraPath.js`
 * derives `MONITOR_VIEW_DISTANCE` from it, and that distance sets both the
 * Digital shot and the whole Campaigns rail's look-at offset. So the model
 * is scaled until ITS screen is that height, and translated until ITS
 * screen sits exactly on `screenFrontZ` at `screenCenterHeight`. Every
 * keyframe therefore still frames the thing it was authored to frame, with
 * no change to the path.
 *
 * The one thing that cannot also be satisfied is the housing's footing: at
 * the scale the screen demands, the model's base lands well below the old
 * plinth's top, so a fixed 0.72 plinth would leave the monitor sunk into
 * the stone. `baseY` is returned for exactly that reason — the stone is
 * placed to meet the model instead. `MONITOR_PLINTH.height` itself stays
 * untouched, because `screenCenterHeight` (and so the camera path) is
 * derived from it.
 */
function useFittedMonitor() {
  const gltf = useModel(MODEL_URLS.monitor)

  return useMemo(() => {
    const holder = new THREE.Group()
    const parts = []
    gltf.scene.traverse((o) => {
      if (o.isMesh && !MODEL_EXCLUDE.test(o.name)) parts.push(o)
      // The panel is kept and used for alignment, then hidden below — the
      // video goes on this project's own plane, whose UVs are a clean 0..1
      // space rather than whatever the author gave the panel.
      if (o.isMesh && o.name === MODEL_SCREEN_NODE) parts.push(o)
    })
    if (!parts.length) return { holder, screenWidth, baseY: MONITOR_PLINTH.height }

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
    if (!screen) return { holder, screenWidth, baseY: MONITOR_PLINTH.height }

    // Turned to face +Z, this project's screen-forward convention.
    //
    // Not cosmetic: the model's housing is not centred on its own screen —
    // it runs 0.78 behind the panel and 0.46 in front of it (the base the
    // screen overhangs). Left unrotated, that 0.78 pointed at the viewer,
    // and since `cameraPath.js` parks the Digital shot only
    // MONITOR_VIEW_DISTANCE (0.675) in front of the screen, the camera sat
    // INSIDE the housing — the monitor rendered perfectly and could not be
    // seen, because the shot was behind its own front faces. Turned round,
    // the housing reaches 0.48 toward the camera and clears it.
    // Measured, not assumed: the display's centre sits at +X of the housing's,
    // so the panel faces +X. -90 degrees about Y turns that onto +Z, this
    // project's screen-forward convention.
    holder.rotation.y = -Math.PI / 2

    const authored = measure(screen)
    holder.scale.setScalar(screenHeight / authored.size.y)

    const scaled = measure(screen)
    holder.position.x -= scaled.center.x
    holder.position.y += screenCenterHeight - scaled.center.y
    // Align the panel's FRONT face, not its centre — the panel has real
    // thickness, and the video plane has to sit just proud of the glass.
    holder.position.z += screenFrontZ - scaled.box.max.z
    holder.updateWorldMatrix(true, true)

    /**
     * The panel is a curved CRT face — 446 triangles bulging 0.28 units along
     * its depth axis — and it ships with NO texture coordinates. That
     * combination is why the previous asset's video went on a separate flat
     * plane, and exactly why the result looked wrong here: a flat rectangle
     * hung in front of a bulging glass face cannot follow it, so the image
     * stood proud at the centre and cut short at the edges.
     *
     * The projection is computed in WORLD space, not in the geometry's own.
     * Projecting on raw vertex positions looked correct on paper and came out
     * rotated 90 degrees, because the `Display` node carries its own rotation:
     * geometry-space Y and Z are not the screen's vertical and horizontal
     * until that transform is applied. Reading each vertex through
     * `matrixWorld` removes the guesswork — after the fit, world X IS the
     * screen's horizontal and world Y its vertical, whatever the author did
     * upstream.
     *
     * The geometry is cloned first: `useLoader` caches the GLB and hands every
     * caller the same buffers, so writing UVs into the original would mutate a
     * shared asset.
     */
    screen.geometry = screen.geometry.clone()
    const geometry = screen.geometry
    const position = geometry.attributes.position
    const world = new THREE.Vector3()
    const worldBox = new THREE.Box3()
    for (let i = 0; i < position.count; i += 1) {
      world.fromBufferAttribute(position, i).applyMatrix4(screen.matrixWorld)
      worldBox.expandByPoint(world)
    }
    const spanX = worldBox.max.x - worldBox.min.x
    const spanY = worldBox.max.y - worldBox.min.y
    const uv = new Float32Array(position.count * 2)
    for (let i = 0; i < position.count; i += 1) {
      world.fromBufferAttribute(position, i).applyMatrix4(screen.matrixWorld)
      uv[i * 2] = (world.x - worldBox.min.x) / spanX
      uv[i * 2 + 1] = (world.y - worldBox.min.y) / spanY
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))

    const fitted = measure(screen)
    return {
      holder,
      screen,
      screenWidth: fitted.size.x,
      baseY: measure(shell).box.min.y,
    }
  }, [gltf])
}

/**
 * The stone pedestal (`digital-stone.glb`), replacing `buildRockGeometry`'s
 * procedural block.
 *
 * `topAt` is the housing's real base rather than `MONITOR_PLINTH.height`,
 * so the monitor lands ON the stone instead of floating above it or sinking
 * into it. The rock is fitted by footprint width and left to run below the
 * floor — it is a boulder the room was built around, not a plinth balanced
 * on the surface, and burying the remainder is both cheaper and more
 * convincing than trying to sit an irregular base flat on a floor.
 */
function useStonePedestal(topAt, footprintWidth) {
  const gltf = useModel(MODEL_URLS.pedestal)

  return useMemo(() => {
    const group = new THREE.Group()
    const rock = cloneNode(gltf, 'Object_2')
    if (!rock) return group
    group.add(rock)

    const authored = measure(rock)
    group.scale.setScalar(footprintWidth / authored.size.x)

    const scaled = measure(rock)
    group.position.x -= scaled.center.x
    group.position.z -= scaled.center.z
    group.position.y += topAt - scaled.box.max.y
    return group
  }, [gltf, topAt, footprintWidth])
}

/** Matte painted-industrial finish, matching the casing this replaces. */
function casingTreatment(material) {
  material.roughness = Math.max(material.roughness ?? 1, 0.72)
  material.metalness = Math.min(material.metalness ?? 0, 0.15)
  if (material.color) material.color.multiplyScalar(0.45)
}

/** Dry, unpolished stone, tuned to sit beside the room's own wall stone. */
function stoneTreatment(material) {
  material.roughness = 0.95
  material.metalness = 0
  if (material.color) material.color.multiplyScalar(0.5)
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

  // Ignite is a pure function of scrollProgress — a smoothstep ramp into
  // MONITOR_SNAP_T, the same mechanism CinemaCamera.jsx already uses for
  // its own lens screen, rather than an onCameraLock event damped over
  // real time (the previous approach here). This is what makes the
  // Film<->Digital transition genuinely reversible: the exact same ignite
  // level shows at a given progress value regardless of how fast, or in
  // which direction, the visitor scrolled to reach it.
  useFrame(() => {
    const p = scrollProgress.value
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

  // The video goes on the model's own curved panel rather than on a plane of
  // this project's making — see the UV generation in `useFittedMonitor`.
  useEffect(() => {
    if (model.screen) model.screen.material = screenMaterial
  }, [model.screen, screenMaterial])
  const pedestal = useStonePedestal(model.baseY, MONITOR_PLINTH.width)

  // The downloaded housing and the stone both arrive lit for someone
  // else's scene. Knocking the albedo down and the roughness up puts them
  // in the same night interior as the walls and columns beside them,
  // rather than reading as brighter objects pasted into it.
  useTreatedMaterials(model.holder, casingTreatment)
  useTreatedMaterials(pedestal, stoneTreatment)

  // Dark-state only: at progress 0 the housing and its plinth were the
  // brightest things in the frame, reading before the architecture. These
  // release back to the treated values above as the room ignites, so the
  // monitor close-up later in the sequence is untouched.
  useDarkStateDimming(model.holder, 0.5)
  useDarkStateDimming(pedestal, 0.45)

  return (
    <group position={BEAM_CENTER} rotation={[0, yawRadians, 0]}>
      <group position={[MONITOR_PLINTH.offsetX, 0, 0]}>
        {/* Stone pedestal (digital-stone.glb), replacing the procedural
            rock. Its top is placed to meet the housing's real base rather
            than a fixed height — see `useFittedMonitor`. */}
        <primitive object={pedestal} />

        {/* Housing (digital-monitor.glb), fitted to the existing screen
            anchor so `cameraPath.js` still frames what it was authored to. */}
        <primitive object={model.holder} />

        {/* No separate screen plane and no glass pane. Both were flat, and
            this panel is curved — a flat quad in front of it is the artefact
            that made the picture read as pasted on rather than displayed. The
            video is on the panel itself, and the CRT's own front face is the
            glass. `coverTransmittance` is 1 below for the same reason: there
            is no longer a pane in front of the image to attenuate it. */}
      </group>
    </group>
  )
}
