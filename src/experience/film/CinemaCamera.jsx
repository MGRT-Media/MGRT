import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createScreenVideoMaterial } from '../digital/screenVideoMaterial.js'

// Phase 2: the cinema-camera object explicitly deferred from Phase 1D
// (build-status.md §4's scope note). A physical, tripod-mounted cinema
// camera — the first major object the visitor discovers, per
// experience-design.md §7 ("ENVIRONMENT -> DISTANT SILHOUETTE -> CAMERA
// BECOMES RECOGNIZABLE -> LENS CATCHES LIGHT -> CAMERA FULLY REVEALED").
//
// Placed between the entrance pillars (z: 4, Environment.jsx) and the
// monitor's arc (centered z: -4), off-axis to the left (x < 0) so it
// doesn't sit on the monitor's own approach line (x: 0.6) or block the
// final monitor-aligned shot. Yawed so the lens generally faces back
// into the room toward the breach's light source (x: 6.85, z: -3,
// volumetricLighting.js) — the object the light "discovers" rather than
// one facing blankly down the room's central axis.
const CAMERA_POSITION = [-2.1, 0, 2.4]
const YAW_DEGREES = -55

const BODY = { width: 0.5, height: 0.34, depth: 0.6, cornerRadius: 0.04 }
const LENS = { frontRadius: 0.085, rearRadius: 0.11, length: 0.32 }
const VIEWFINDER = { width: 0.12, height: 0.1, depth: 0.14 }
const TRIPOD = { legRadius: 0.02, legLength: 1.05, spreadRadius: 0.42, mountHeight: 0.1 }

const bodyCenterHeight = TRIPOD.legLength * 0.94 + TRIPOD.mountHeight
const lensCenterZ = BODY.depth / 2 + LENS.length / 2
const lensFrontZ = BODY.depth / 2 + LENS.length

/**
 * `lensFrontFieldPosition`/`lensForward` describe the lens's front element
 * in world space — the anchor Phase 2's Film camera-path keyframes will
 * target for the close "lens fills the frame" transition shot, the same
 * role `MONITOR_ANCHOR` plays for the Digital handshake. Not consumed yet
 * (cameraPath.js keyframes are a separate, following step); exported now
 * so that step derives its framing from the object's real geometry rather
 * than hand-picked numbers, per this project's established convention.
 */
const yawRadians = THREE.MathUtils.degToRad(YAW_DEGREES)
const forwardLocal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRadians)
const bodyOrigin = new THREE.Vector3(...CAMERA_POSITION).setY(bodyCenterHeight)

export const CAMERA_ANCHOR = {
  position: CAMERA_POSITION,
  bodyCenterHeight,
  yawDegrees: YAW_DEGREES,
  lensRadius: LENS.frontRadius,
  lensFrontFieldPosition: bodyOrigin.clone().addScaledVector(forwardLocal, lensFrontZ).toArray(),
  lensForward: forwardLocal.toArray(),
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
    () => new THREE.CylinderGeometry(LENS.frontRadius, LENS.rearRadius, LENS.length, 20),
    [],
  )
  const legGeometry = useMemo(
    () => new THREE.CylinderGeometry(TRIPOD.legRadius, TRIPOD.legRadius * 1.4, TRIPOD.legLength, 8),
    [],
  )
  const mountGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.07, 0.09, TRIPOD.mountHeight, 12),
    [],
  )

  // Screen behind the lens glass — placeholder for the Film media
  // (film-01-hero.mp4). Dormant/unlit for now (uIgnite fixed at 0): the
  // ignite trigger belongs to the camera-path/lock integration that
  // follows this step, the same way Monitor.jsx's screen stayed dormant
  // until its own onCameraLock wiring was added.
  const lensScreenMaterial = useMemo(() => {
    const video = document.createElement('video')
    video.src = '/media/film/film-01-hero.mp4'
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    const texture = new THREE.VideoTexture(video)
    return createScreenVideoMaterial(texture)
  }, [])

  // Body/tripod: dark, moderately metallic — a rubberized-metal cinema
  // camera finish, distinct from the monitor's matte painted casing
  // (Monitor.jsx's casingProps, metalness: 0.12) so the two objects read
  // as different material families rather than palette-matched twins.
  const bodyProps = { color: '#1c1c1e', roughness: 0.55, metalness: 0.4 }
  const tripodProps = { color: '#161616', roughness: 0.6, metalness: 0.5 }

  return (
    <group position={CAMERA_POSITION} rotation={[0, yawRadians, 0]}>
      {/* Tripod legs — three, splayed evenly around the mount */}
      {[0, 120, 240].map((deg) => {
        const rad = THREE.MathUtils.degToRad(deg)
        const x = Math.sin(rad) * TRIPOD.spreadRadius
        const z = Math.cos(rad) * TRIPOD.spreadRadius
        const lean = THREE.MathUtils.degToRad(14)
        return (
          <mesh
            key={deg}
            position={[x * 0.5, TRIPOD.legLength / 2, z * 0.5]}
            rotation={[Math.sin(rad) === 0 ? 0 : -Math.cos(rad) * lean, 0, Math.sin(rad) * lean]}
            geometry={legGeometry}
            material={new THREE.MeshStandardMaterial(tripodProps)}
            castShadow
            receiveShadow
          />
        )
      })}

      {/* Fluid-head mount, connecting the tripod to the body */}
      <mesh position={[0, TRIPOD.legLength * 0.94 + TRIPOD.mountHeight / 2, 0]} geometry={mountGeometry} castShadow receiveShadow>
        <meshStandardMaterial {...tripodProps} />
      </mesh>

      {/* Camera body */}
      <mesh position={[0, bodyCenterHeight, 0]} geometry={bodyGeometry} castShadow receiveShadow>
        <meshStandardMaterial {...bodyProps} />
      </mesh>

      {/* Viewfinder — small raised block, upper-rear of the body */}
      <mesh
        position={[0, bodyCenterHeight + BODY.height / 2 + VIEWFINDER.height / 2 - 0.02, -BODY.depth / 2 + VIEWFINDER.depth / 2 + 0.03]}
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
          transmission={0.8}
          thickness={0.02}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Placeholder film-media screen, set just behind the glass — dormant until the follow-up camera-path/ignite step */}
      <mesh position={[0, bodyCenterHeight, lensFrontZ - 0.02]} castShadow={false} receiveShadow={false}>
        <circleGeometry args={[LENS.frontRadius * 0.85, 24]} />
        <primitive object={lensScreenMaterial} attach="material" />
      </mesh>
    </group>
  )
}
