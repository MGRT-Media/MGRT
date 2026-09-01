import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createScreenVideoMaterial } from '../digital/screenVideoMaterial.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { FILM_FOCUS_T, FILM_IGNITE_RISE } from '../timeline/filmActBeats.js'
import { PLINTH_CENTER, PLINTH_TOP_Y, PLINTH_YAW_DEGREES, OBJECT_OFFSET_X } from '../digital/plinthAnchor.js'

// Phase 2: the cinema-camera object explicitly deferred from Phase 1D
// (build-status.md §4's scope note), now sharing the widened Digital
// plinth with the Monitor per explicit request — not its own separate
// floor-standing object. Sits at the plinth's local -OBJECT_OFFSET_X
// (Monitor at +OBJECT_OFFSET_X, `Monitor.jsx`/`plinthAnchor.js`), tilted
// an additional `TILT_TOWARD_MONITOR_DEGREES` on top of the shared plinth
// yaw so the lens turns toward the Monitor rather than staying parallel
// to it — "a natural composition on the plinth," per explicit request.
const TILT_TOWARD_MONITOR_DEGREES = 32

const BODY = { width: 0.42, height: 0.28, depth: 0.5, cornerRadius: 0.035 }
const LENS = { frontRadius: 0.07, rearRadius: 0.09, length: 0.26 }
const VIEWFINDER = { width: 0.1, height: 0.08, depth: 0.12 }
// A compact plinth-top mount replaces Phase 2's earlier full-height floor
// tripod — a tall tripod would read as absurd standing on a plinth
// shared with the monitor. A short pedestal (base plate + riser) keeps
// the camera physically supported without competing with the monitor's
// own stacked-console silhouette.
const STAND = { baseRadius: 0.13, baseHeight: 0.03, riserRadius: 0.05, riserHeight: 0.12 }

const bodyCenterHeight = PLINTH_TOP_Y + STAND.baseHeight + STAND.riserHeight + BODY.height / 2
const lensCenterZ = BODY.depth / 2 + LENS.length / 2
const lensFrontZ = BODY.depth / 2 + LENS.length

// World-space anchor, combining the shared plinth's yaw with this
// object's own local offset AND its extra tilt — both are pure Y-axis
// rotations, so they compose by simple addition. Exported for
// `cameraPath.js`'s Act 1 hero-shot keyframe to derive its framing from
// the object's real geometry rather than hand-picked numbers, the same
// role `MONITOR_ANCHOR` plays for the Digital handshake.
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const plinthYawRadians = THREE.MathUtils.degToRad(PLINTH_YAW_DEGREES)
const tiltRadians = THREE.MathUtils.degToRad(TILT_TOWARD_MONITOR_DEGREES)
const totalYawRadians = plinthYawRadians + tiltRadians

const localOffset = new THREE.Vector3(-OBJECT_OFFSET_X, 0, 0).applyAxisAngle(Y_AXIS, plinthYawRadians)
const worldOrigin = localOffset.add(new THREE.Vector3(PLINTH_CENTER[0], 0, PLINTH_CENTER[2]))
const lensForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y_AXIS, totalYawRadians)
const bodyWorldOrigin = worldOrigin.clone().setY(bodyCenterHeight)
const lensFrontFieldPosition = bodyWorldOrigin.clone().addScaledVector(lensForward, lensFrontZ)

export const CAMERA_ANCHOR = {
  bodyCenterHeight,
  lensRadius: LENS.frontRadius,
  lensFrontFieldPosition: lensFrontFieldPosition.toArray(),
  lensForward: lensForward.toArray(),
}

export default function CinemaCamera() {
  const bodyGeometry = useMemo(
    () => new RoundedBoxGeometry(BODY.width, BODY.height, BODY.depth, 3, BODY.cornerRadius),
    [],
  )
  const viewfinderGeometry = useMemo(
    () => new RoundedBoxGeometry(VIEWFINDER.width, VIEWFINDER.height, VIEWFINDER.depth, 2, 0.015),
    [],
  )
  const lensGeometry = useMemo(
    // openEnded: true — a hollow tube, not a solid capped cylinder. Capped
    // (the default) would give the barrel its own opaque front face,
    // hiding the film-media screen mesh sitting just behind it.
    () => new THREE.CylinderGeometry(LENS.frontRadius, LENS.rearRadius, LENS.length, 20, 1, true),
    [],
  )
  const standBaseGeometry = useMemo(
    () => new THREE.CylinderGeometry(STAND.baseRadius, STAND.baseRadius * 1.1, STAND.baseHeight, 16),
    [],
  )
  const standRiserGeometry = useMemo(
    () => new THREE.CylinderGeometry(STAND.riserRadius, STAND.riserRadius * 1.3, STAND.riserHeight, 12),
    [],
  )

  // Lens screen — Act 1's Film media (film-01-hero.mp4), sharing the same
  // dormant/ignite unlit material as the monitor screen. Ignition here is
  // NOT the onCameraLock binary event `Monitor.jsx` uses (that fires once
  // at the very end of the scroll); it's a smooth "hill" centered on
  // FILM_FOCUS_T — the scroll progress reads continuously in this
  // object's own useFrame, matching how VolumetricLightingRig derives its
  // own ignition directly from scrollProgress rather than an event.
  const video = useMemo(() => {
    const el = document.createElement('video')
    el.src = '/media/film/film-01-hero.mp4'
    el.loop = true
    el.muted = true
    el.playsInline = true
    el.preload = 'auto'
    return el
  }, [])
  const videoTexture = useMemo(() => new THREE.VideoTexture(video), [video])
  const lensScreenMaterial = useMemo(() => createScreenVideoMaterial(videoTexture), [videoTexture])
  const wasPlaying = useRef(false)

  useFrame(() => {
    const p = scrollProgress.value
    const rise = THREE.MathUtils.smoothstep(p, FILM_FOCUS_T - FILM_IGNITE_RISE, FILM_FOCUS_T)
    const fall = 1 - THREE.MathUtils.smoothstep(p, FILM_FOCUS_T, FILM_FOCUS_T + FILM_IGNITE_RISE)
    const ignite = Math.min(rise, fall)
    lensScreenMaterial.uniforms.uIgnite.value = ignite

    const shouldPlay = ignite > 0.02
    if (shouldPlay && !wasPlaying.current) {
      video.currentTime = 0
      video.play().catch(() => {})
    } else if (!shouldPlay && wasPlaying.current) {
      video.pause()
    }
    wasPlaying.current = shouldPlay
  })

  // Body/stand: dark, moderately metallic — a rubberized-metal cinema
  // camera finish, distinct from the monitor's matte painted casing
  // (Monitor.jsx's casingProps, metalness: 0.12) so the two objects read
  // as different material families rather than palette-matched twins.
  const bodyProps = { color: '#1c1c1e', roughness: 0.55, metalness: 0.4 }
  const standProps = { color: '#161616', roughness: 0.6, metalness: 0.5 }

  return (
    <group position={PLINTH_CENTER} rotation={[0, plinthYawRadians, 0]}>
      <group position={[-OBJECT_OFFSET_X, 0, 0]} rotation={[0, tiltRadians, 0]}>
        {/* Compact plinth-top mount */}
        <mesh position={[0, PLINTH_TOP_Y + STAND.baseHeight / 2, 0]} geometry={standBaseGeometry} castShadow receiveShadow>
          <meshStandardMaterial {...standProps} />
        </mesh>
        <mesh
          position={[0, PLINTH_TOP_Y + STAND.baseHeight + STAND.riserHeight / 2, 0]}
          geometry={standRiserGeometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial {...standProps} />
        </mesh>

        {/* Camera body */}
        <mesh position={[0, bodyCenterHeight, 0]} geometry={bodyGeometry} castShadow receiveShadow>
          <meshStandardMaterial {...bodyProps} />
        </mesh>

        {/* Viewfinder — small raised block, upper-rear of the body */}
        <mesh
          position={[
            0,
            bodyCenterHeight + BODY.height / 2 + VIEWFINDER.height / 2 - 0.015,
            -BODY.depth / 2 + VIEWFINDER.depth / 2 + 0.02,
          ]}
          geometry={viewfinderGeometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial {...bodyProps} />
        </mesh>

        {/* Lens barrel — tapers slightly toward the front element */}
        <mesh
          position={[0, bodyCenterHeight, lensCenterZ]}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={lensGeometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#0e0e0f" roughness={0.45} metalness={0.6} />
        </mesh>

        {/* Front glass element — same reflective-glass language as Monitor.jsx */}
        <mesh position={[0, bodyCenterHeight, lensFrontZ + 0.002]} castShadow={false} receiveShadow={false}>
          <circleGeometry args={[LENS.frontRadius * 0.92, 24]} />
          <meshPhysicalMaterial
            color="#050506"
            roughness={0.05}
            metalness={0}
            transmission={0.85}
            thickness={0.02}
            transparent
            opacity={0.22}
          />
        </mesh>

        {/* Film-media screen, just behind the glass — ignites around the Act 1 hero beat */}
        <mesh position={[0, bodyCenterHeight, lensFrontZ - 0.02]} castShadow={false} receiveShadow={false}>
          <circleGeometry args={[LENS.frontRadius * 0.85, 24]} />
          <primitive object={lensScreenMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  )
}
