import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { createScreenVideoMaterial } from './screenVideoMaterial.js'
import { MODEL_URLS, cloneNode, measure, useModel, useTreatedMaterials } from '../models/modelAssets.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { MONITOR_SNAP_T, DIGITAL_IGNITE_RISE } from '../timeline/filmActBeats.js'
import { BEAM_CENTER, YAW_DEGREES, MONITOR_PLINTH } from './plinthAnchor.js'

// Phase 2: curated Digital work, per experience-design.md §8 ("approximately
// 2-4 selected Digital projects"). One clip for now — extending to a
// scroll-mapped sequence of several is future work, not part of this swap.
// Exported so FullscreenButton.jsx's modal CTA (§4BN) can play the same
// file directly, instead of hardcoding this path a second time.
export const DIGITAL_MEDIA_SRC = '/media/digital/digital-01-website.mp4'

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
const MODEL_BODY_NODE = 'PC2_Material_0'
const MODEL_SCREEN_NODE = 'PC2_Display_0'

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
    const body = cloneNode(gltf, MODEL_BODY_NODE)
    const screen = cloneNode(gltf, MODEL_SCREEN_NODE)
    if (!body || !screen) return { holder, screenWidth, baseY: MONITOR_PLINTH.height }
    holder.add(body, screen)

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
    holder.rotation.y = Math.PI

    const authored = measure(screen)
    holder.scale.setScalar(screenHeight / authored.size.y)

    const scaled = measure(screen)
    holder.position.x -= scaled.center.x
    holder.position.y += screenCenterHeight - scaled.center.y
    // Align the panel's FRONT face, not its centre — the panel has real
    // thickness, and the video plane has to sit just proud of the glass.
    holder.position.z += screenFrontZ - scaled.box.max.z
    holder.updateWorldMatrix(true, true)

    // The GLB's own screen panel is kept in the tree but hidden. The video
    // goes on this project's own plane instead of on that panel: the
    // panel's UVs are whatever the author gave it, while
    // `screenVideoMaterial.js` does its cover-fit in a clean 0..1 space.
    screen.visible = false

    const fitted = measure(screen)
    return {
      holder,
      screenWidth: fitted.size.x,
      baseY: measure(body).box.min.y,
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
    el.preload = 'auto'
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
        coverTransmittance: 0.76,
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
  const pedestal = useStonePedestal(model.baseY, MONITOR_PLINTH.width)

  // The downloaded housing and the stone both arrive lit for someone
  // else's scene. Knocking the albedo down and the roughness up puts them
  // in the same night interior as the walls and columns beside them,
  // rather than reading as brighter objects pasted into it.
  useTreatedMaterials(model.holder, casingTreatment)
  useTreatedMaterials(pedestal, stoneTreatment)

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

        {/*
          Screen surface — unchanged in every way that matters. Same
          `screenVideoMaterial`, same scroll-driven `uIgnite` ramp, same
          video element and seamless-loop handling; only its width now
          comes from the model's own panel so the image sits in the recess
          instead of overhanging it. Height is still `screenHeight`, which
          is the dimension the camera path derives from.
        */}
        <mesh position={[0, screenCenterHeight, screenFrontZ]} castShadow={false} receiveShadow={false}>
          <planeGeometry args={[model.screenWidth, screenHeight]} />
          <primitive object={screenMaterial} attach="material" />
        </mesh>

        {/* Glass — a thin, subtly reflective pane over the screen. Sized
            from the model's panel for the same reason as the screen above.
            Kept, not dropped: `screenVideoMaterial`'s `coverTransmittance`
            is calibrated against this pane's 0.25 opacity, and removing it
            would silently invalidate that. */}
        <mesh position={[0, screenCenterHeight, glassFrontZ]} castShadow={false} receiveShadow={false}>
          <planeGeometry args={[model.screenWidth + 0.02, screenHeight + 0.02]} />
          <meshPhysicalMaterial
            color="#0a0a0c"
            roughness={0.08}
            metalness={0}
            transmission={0.85}
            thickness={0.02}
            transparent
            opacity={0.25}
          />
        </mesh>
      </group>
    </group>
  )
}
