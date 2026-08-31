import * as THREE from 'three'
import { useMemo } from 'react'
import VolumetricLightingRig from './lighting/VolumetricLightingRig.jsx'

const HALL_WIDTH = 14
const HALL_DEPTH = 32
const HALL_HEIGHT = 9
const COLUMN_COUNT_PER_SIDE = 4

const columnPositions = Array.from({ length: COLUMN_COUNT_PER_SIDE }, (_, i) => {
  const z = 6 - i * 6
  return [
    [-HALL_WIDTH / 2 + 1, z],
    [HALL_WIDTH / 2 - 1, z],
  ]
}).flat()

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
 * and are unchanged here. The Phase 1A placeholder hemisphere/ambient
 * "visibility aid" light has been replaced by the real Phase 1B lighting
 * system (`VolumetricLightingRig`); material colors are otherwise
 * untouched — the room reads darker now because it is genuinely lit by a
 * single directional source instead of flat fill light, not because any
 * surface color changed.
 */
export default function Environment() {
  const columnGeometry = useColumnGeometry(HALL_HEIGHT)

  return (
    <group>
      <VolumetricLightingRig />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, HALL_HEIGHT / 2, -HALL_DEPTH / 2]} receiveShadow>
        <planeGeometry args={[HALL_WIDTH, HALL_HEIGHT]} />
        <meshStandardMaterial color="#5c5c5c" roughness={0.95} metalness={0} />
      </mesh>

      {/* Side walls */}
      <mesh position={[-HALL_WIDTH / 2, HALL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[HALL_DEPTH, HALL_HEIGHT]} />
        <meshStandardMaterial color="#525252" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[HALL_WIDTH / 2, HALL_HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[HALL_DEPTH, HALL_HEIGHT]} />
        <meshStandardMaterial color="#525252" roughness={0.95} metalness={0} />
      </mesh>

      {/* Structural columns */}
      {columnPositions.map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]} geometry={columnGeometry} castShadow receiveShadow>
          <meshStandardMaterial color="#6a6a6a" roughness={0.85} metalness={0.1} />
        </mesh>
      ))}
    </group>
  )
}
