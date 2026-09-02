import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createScreenVideoMaterial } from './screenVideoMaterial.js'
import { createStoneWallMaterial } from '../materials/stoneWallMaterial.js'
import { buildRockGeometry } from './buildRockGeometry.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { MONITOR_SNAP_T, DIGITAL_IGNITE_RISE } from '../timeline/filmActBeats.js'
import { BEAM_CENTER, YAW_DEGREES, MONITOR_PLINTH } from './plinthAnchor.js'

// Phase 2: curated Digital work, per experience-design.md §8 ("approximately
// 2-4 selected Digital projects"). One clip for now — extending to a
// scroll-mapped sequence of several is future work, not part of this swap.
const DIGITAL_MEDIA_SRC = '/media/digital/digital-01-website.mp4'

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
  const screenMaterial = useMemo(
    () => createScreenVideoMaterial(videoTexture, screenWidth / screenHeight),
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
  })

  const plinthGeometry = useMemo(
    () => buildRockGeometry(MONITOR_PLINTH.width, MONITOR_PLINTH.height, MONITOR_PLINTH.depth),
    [],
  )
  const plinthMaterial = useMemo(() => createStoneWallMaterial('#6e685e', [1, 1]), [])
  const housingGeometry = useMemo(
    () => new RoundedBoxGeometry(HOUSING.width, HOUSING.height, HOUSING.frontDepth, 3, HOUSING.cornerRadius),
    [],
  )
  const rearHumpGeometry = useMemo(
    () => new RoundedBoxGeometry(HOUSING.rearWidth, HOUSING.rearHeight, HOUSING.rearDepth, 3, HOUSING.cornerRadius),
    [],
  )

  // Casing material: matte, mostly non-metallic — a painted/textured
  // industrial finish rather than a sleek brushed-aluminum look.
  const casingProps = { color: '#2b2a28', roughness: 0.75, metalness: 0.12 }

  return (
    <group position={BEAM_CENTER} rotation={[0, yawRadians, 0]}>
      <group position={[MONITOR_PLINTH.offsetX, 0, 0]}>
        {/* Own dedicated stone plinth — beside, not shared with, the Cinema Camera's */}
        <mesh
          position={[0, MONITOR_PLINTH.height / 2, 0]}
          geometry={plinthGeometry}
          material={plinthMaterial}
          castShadow
          receiveShadow
        />

        {/* Rear hump — a smaller, recessed box suggesting the CRT tube's depth */}
        <mesh
          position={[0, housingCenterY, -HOUSING.frontDepth / 2 - HOUSING.rearDepth / 2 + 0.03]}
          geometry={rearHumpGeometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial {...casingProps} />
        </mesh>

        {/* Main housing — deep, boxy, rounded-corner chassis */}
        <mesh position={[0, housingCenterY, 0]} geometry={housingGeometry} castShadow receiveShadow>
          <meshStandardMaterial {...casingProps} />
        </mesh>

        {/*
          Control knobs — small retro detail on the lower bezel. Shadow
          casting deliberately off: at this scale (0.028 radius) relative to
          the shadow map's texel density across the light's full frustum,
          thin geometry like this is exactly what's prone to shadow-map
          aliasing/shimmer, for negligible visual payoff — per
          technical-architecture.md §8's "disable shadows on objects where
          they provide negligible visual value."
        */}
        {[-0.14, 0].map((x, i) => (
          <mesh
            key={i}
            position={[x, screenCenterHeight - screenHeight / 2 - 0.08, screenFrontZ - 0.01]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow={false}
          >
            <cylinderGeometry args={[0.028, 0.028, 0.03, 16]} />
            <meshStandardMaterial color="#111112" roughness={0.6} metalness={0.3} />
          </mesh>
        ))}

        {/*
          Screen surface — live video texture (Phase 2 Digital media), still
          gated behind `uIgnite` (see the material module and the
          scrollProgress-driven ignite ramp above): dark/dormant until the
          camera nears the monitor lock. `screenVideoMaterial` is a raw unlit
          ShaderMaterial (no PBR lighting model), so roughness/metalness
          don't apply to it — its "emission" is just its fragment-shader
          output read directly, `toneMapped: false`. Explicitly excluded
          from both cast and receive shadows so neither the bezel nor the
          entrance/side pillars can cast a shadow onto the (once ignited)
          glowing screen face.
        */}
        <mesh position={[0, screenCenterHeight, screenFrontZ]} castShadow={false} receiveShadow={false}>
          <planeGeometry args={[screenWidth, screenHeight]} />
          <primitive object={screenMaterial} attach="material" />
        </mesh>

        {/* Glass — a thin, subtly reflective pane over the screen */}
        <mesh position={[0, screenCenterHeight, glassFrontZ]} castShadow={false} receiveShadow={false}>
          <planeGeometry args={[screenWidth + 0.02, screenHeight + 0.02]} />
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
