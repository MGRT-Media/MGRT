import * as THREE from 'three'
import { useMemo } from 'react'
import VolumetricLightingRig from './lighting/VolumetricLightingRig.jsx'

const HALL_WIDTH = 14
const HALL_DEPTH = 32
const HALL_HEIGHT = 9
const COLUMN_COUNT_PER_SIDE = 4

/**
 * Three-tier surface tonality, lightest to darkest: columns catch the most
 * ambient light and draw primary focus, walls sit at a mid charcoal tone
 * for depth/boundary readability, and the floor stays darkest so the
 * volumetric light pool and column bases stand out against it.
 */
const SURFACE_TONE = {
  column: '#8c8c8c',
  wallBack: '#5e5e5e',
  wallSide: '#565656',
  floor: '#484848',
}

const columnPositions = Array.from({ length: COLUMN_COUNT_PER_SIDE }, (_, i) => {
  const z = 6 - i * 6
  return [
    [-HALL_WIDTH / 2 + 1, z],
    [HALL_WIDTH / 2 - 1, z],
  ]
}).flat()

/**
 * Entrance pillars — a foreground pair flanking the camera's hero start
 * ([0, 1.6, 9]) and the first leg of its path (which stays at x: 0 through
 * z: 9 → 5, per cameraPath.js). Placed close to center (unlike the side
 * colonnade at x: ∓6) so they read as a near-camera "gateway" the eye — and
 * the camera — passes through toward the monitor, distinct in scale from
 * the side columns for depth/parallax.
 */
const entrancePillarPositions = [
  [-2.2, 4],
  [2.2, 4],
]

/**
 * Clerestory-style window band on the right side wall (x = +HALL_WIDTH/2),
 * upper portion — per creative-reference.md's own "strong directional
 * sunlight through high apertures" brief. Three window units spaced at
 * z: 3, -3, -9, each centered between a pair of the existing structural
 * columns (z: 6, 0, -6, -12) so no window sits directly behind a column.
 *
 * These are decorative glass apertures only — visually identical bright
 * panes, not individual light sources. The actual illumination is the
 * repositioned primary SpotLight in `volumetricLighting.js`, positioned
 * to coincide with the z: -3 window (nearest the monitor/floor target) so
 * its beam visually originates there. The z: 3 and z: -9 windows exist
 * purely for architectural rhythm — a single window would read as an odd
 * one-off cutout rather than a coherent window band.
 */
const WINDOW = {
  width: 1.3,
  height: 3.2,
  centerY: 6.3,
  frameThickness: 0.07,
  frameDepth: 0.1,
  glassColor: '#fff6e2',
}
const windowZPositions = [3, -3, -9]

/**
 * A simple classical column profile (plinth → shaft with a subtle taper →
 * capital), revolved into a single restrained LatheGeometry. Deliberately
 * plain — no fluting, carving, or ornamentation — and shared across every
 * column instance rather than rebuilt per-mesh.
 */
function useColumnGeometry(height) {
  return useMemo(() => {
    const baseRadius = 0.4
    const shaftRadius = 0.26
    const capitalRadius = 0.36
    const plinthHeight = 0.16
    const capitalHeight = 0.22

    const points = [
      new THREE.Vector2(baseRadius, 0),
      new THREE.Vector2(baseRadius, plinthHeight * 0.6),
      new THREE.Vector2(shaftRadius, plinthHeight),
      new THREE.Vector2(shaftRadius * 0.96, height - capitalHeight),
      new THREE.Vector2(shaftRadius, height - capitalHeight),
      new THREE.Vector2(capitalRadius, height - capitalHeight * 0.5),
      new THREE.Vector2(capitalRadius, height),
    ]

    const geometry = new THREE.LatheGeometry(points, 16)
    geometry.computeVertexNormals()
    return geometry
  }, [height])
}

/**
 * One window unit: a bright unlit glass pane (`toneMapped: false`, same
 * treatment as the monitor's screen material — ACES tonemapping crushes
 * low-radiance colors, so a plain lit material here would just look like
 * a dim gray rectangle rather than glowing daylight) plus a simple dark
 * frame border. Sits just inside the wall's own x-position to avoid
 * z-fighting with the solid wall plane behind it.
 */
function Window({ z }) {
  const wallX = HALL_WIDTH / 2
  const { width, height, centerY, frameThickness, frameDepth, glassColor } = WINDOW
  const halfW = width / 2
  const halfH = height / 2

  return (
    <group position={[wallX - 0.02, centerY, z]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={glassColor} toneMapped={false} />
      </mesh>
      {/* Frame bars: top, bottom, left, right */}
      <mesh position={[0, halfH + frameThickness / 2, 0]}>
        <boxGeometry args={[width + frameThickness * 2, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#1d1d1e" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, -halfH - frameThickness / 2, 0]}>
        <boxGeometry args={[width + frameThickness * 2, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#1d1d1e" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[-halfW - frameThickness / 2, 0, 0]}>
        <boxGeometry args={[frameThickness, height, frameDepth]} />
        <meshStandardMaterial color="#1d1d1e" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[halfW + frameThickness / 2, 0, 0]}>
        <boxGeometry args={[frameThickness, height, frameDepth]} />
        <meshStandardMaterial color="#1d1d1e" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  )
}

/**
 * Persistent architectural shell: floor, walls, structural columns, and
 * (as of the window/relighting revision — see `Window` and
 * `volumetricLighting.js`'s repositioned spot) a clerestory window band.
 *
 * Core room dimensions, column geometry, and overall layout are the
 * approved Phase 1A foundation and are unchanged. Lighting comes from the
 * Phase 1B system (`VolumetricLightingRig`). Surface base colors follow
 * the three-tier tonality in `SURFACE_TONE` (columns lightest, walls mid,
 * floor darkest), per Phase 1B review feedback.
 */
export default function Environment() {
  const columnGeometry = useColumnGeometry(HALL_HEIGHT)

  return (
    <group>
      <VolumetricLightingRig />

      {/* Floor — darkest tier */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH, 32, 64]} />
        <meshStandardMaterial color={SURFACE_TONE.floor} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Back wall — mid tier */}
      <mesh position={[0, HALL_HEIGHT / 2, -HALL_DEPTH / 2]} receiveShadow>
        <planeGeometry args={[HALL_WIDTH, HALL_HEIGHT]} />
        <meshStandardMaterial color={SURFACE_TONE.wallBack} roughness={0.95} metalness={0} />
      </mesh>

      {/* Side walls — mid tier */}
      <mesh position={[-HALL_WIDTH / 2, HALL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[HALL_DEPTH, HALL_HEIGHT]} />
        <meshStandardMaterial color={SURFACE_TONE.wallSide} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[HALL_WIDTH / 2, HALL_HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[HALL_DEPTH, HALL_HEIGHT]} />
        <meshStandardMaterial color={SURFACE_TONE.wallSide} roughness={0.95} metalness={0} />
      </mesh>

      {/* Structural columns — lightest tier */}
      {columnPositions.map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]} geometry={columnGeometry} castShadow receiveShadow>
          <meshStandardMaterial color={SURFACE_TONE.column} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}

      {/* Entrance pillars — lightest tier, matches the side colonnade */}
      {entrancePillarPositions.map(([x, z], i) => (
        <mesh key={`entrance-${i}`} position={[x, 0, z]} geometry={columnGeometry} castShadow receiveShadow>
          <meshStandardMaterial color={SURFACE_TONE.column} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}

      {/* Clerestory window band — right side wall, upper band */}
      {windowZPositions.map((z) => (
        <Window key={`window-${z}`} z={z} />
      ))}
    </group>
  )
}
