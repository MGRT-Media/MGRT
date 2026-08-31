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
 * Persistent architectural shell: floor, walls, structural columns.
 *
 * Geometry, proportions, and layout are the approved Phase 1A foundation
 * and are unchanged here. Lighting comes from the Phase 1B system
 * (`VolumetricLightingRig`). Surface base colors follow the three-tier
 * tonality in `SURFACE_TONE` (columns lightest, walls mid, floor darkest),
 * per Phase 1B review feedback.
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
    </group>
  )
}
