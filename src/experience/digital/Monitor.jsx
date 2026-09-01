import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createScreenVideoMaterial } from './screenVideoMaterial.js'
import { onCameraLock, onCameraUnlock } from '../timeline/cameraLockEvent.js'
import { PLINTH_CENTER, PLINTH_TOP_Y, PLINTH_YAW_DEGREES, OBJECT_OFFSET_X } from './plinthAnchor.js'

// Phase 2: curated Digital work, per experience-design.md §8 ("approximately
// 2-4 selected Digital projects"). One clip for now — extending to a
// scroll-mapped sequence of several is future work, not part of this swap.
const DIGITAL_MEDIA_SRC = '/media/digital/digital-01-website.mp4'

// How quickly the screen's uIgnite uniform eases toward its 0/1 target
// once the camera locks/unlocks — a brief, tasteful fade for the raw
// on/off hook itself (THREE.MathUtils.damp, same frame-rate-independent
// approach used throughout this project's scroll/camera work), NOT a
// full power-on sequence — that's future work, per the request's explicit
// "do not populate full screen content... yet" scope.
const IGNITE_DAMP_LAMBDA = 4

/**
 * Phase 2 Digital console — a retro/mid-century industrial reference-
 * monitor, now sharing the widened plinth (`plinthAnchor.js`,
 * `DigitalPlinth.jsx`) with the Cinema Camera instead of standing on its
 * own dedicated stone block. The plinth itself and the shared yaw/position
 * transform moved out of this file; `Monitor` now only owns the console
 * geometry, offset `+OBJECT_OFFSET_X` along the plinth's own local X axis
 * (mirrored by `CinemaCamera.jsx`'s `-OBJECT_OFFSET_X`) so the two objects
 * sit side by side rather than stacked at the same origin.
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

const housingCenterY = PLINTH_TOP_Y + HOUSING.height / 2
const screenWidth = HOUSING.width - BEZEL.side * 2
const screenHeight = HOUSING.height - BEZEL.top - BEZEL.bottom
// Bottom bezel is deliberately taller (control-panel area), so the screen
// itself sits slightly above the housing's own vertical center.
const screenCenterOffset = (BEZEL.bottom - BEZEL.top) / 2
const screenCenterHeight = housingCenterY + screenCenterOffset

const screenFrontZ = HOUSING.frontDepth / 2 + 0.002
const glassFrontZ = screenFrontZ + 0.004

// The screen's real world-space position and facing direction, accounting
// for both the shared plinth's yaw AND this object's own local X offset —
// replaces the Phase 1D approximation that used the plinth's bare center
// point directly (acceptable then, when the monitor sat at that origin
// unoffset; no longer accurate now that it's offset onto one side of a
// shared plinth). `cameraPath.js`'s monitor-aligned shot derives its
// framing from these instead of a hand-adjusted position.
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const plinthYawRadians = THREE.MathUtils.degToRad(PLINTH_YAW_DEGREES)
const screenWorldPosition = new THREE.Vector3(OBJECT_OFFSET_X, screenCenterHeight, screenFrontZ)
  .applyAxisAngle(Y_AXIS, plinthYawRadians)
  .add(new THREE.Vector3(PLINTH_CENTER[0], 0, PLINTH_CENTER[2]))
const screenForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y_AXIS, plinthYawRadians)

export const MONITOR_ANCHOR = {
  position: PLINTH_CENTER,
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
  const screenMaterial = useMemo(() => createScreenVideoMaterial(videoTexture), [videoTexture])

  // Target for the screen's ignite state — a plain ref (not React state),
  // flipped by the onCameraLock/onCameraUnlock event mechanism below and
  // read every frame to damp the material's actual uIgnite uniform toward
  // it. Reversible by design: unlocking (scrolling back out) resets the
  // target to 0, so the screen goes dormant again rather than staying lit
  // forever after the first visit — consistent with this scene's scroll
  // being fully reversible everywhere else.
  const igniteTarget = useRef(0)

  // Media playback follows technical-architecture.md §11: prepared/played
  // only once the camera actually reaches the monitor, paused and reset
  // once it leaves — not tied to raw DOM visibility, and not left playing
  // for the whole experience. `.play()` is wrapped since it returns a
  // promise that can reject (e.g. a not-yet-ready decode); a failed
  // playback attempt must not break the cinematic timeline (§11 "Media
  // fallback").
  useEffect(() => {
    const offLock = onCameraLock(() => {
      igniteTarget.current = 1
      video.currentTime = 0
      video.play().catch(() => {})
    })
    const offUnlock = onCameraUnlock(() => {
      igniteTarget.current = 0
      video.pause()
    })
    return () => {
      offLock()
      offUnlock()
      video.pause()
    }
  }, [video])

  useFrame((_, delta) => {
    const uniform = screenMaterial.uniforms.uIgnite
    uniform.value = THREE.MathUtils.damp(uniform.value, igniteTarget.current, IGNITE_DAMP_LAMBDA, delta)
  })

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
    <group position={PLINTH_CENTER} rotation={[0, plinthYawRadians, 0]}>
      <group position={[OBJECT_OFFSET_X, 0, 0]}>
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
          onCameraLock wiring above): dark/dormant until the camera reaches
          the monitor lock. `screenVideoMaterial` is a raw unlit
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
