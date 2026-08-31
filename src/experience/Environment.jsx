const HALL_WIDTH = 14
const HALL_DEPTH = 32
const HALL_HEIGHT = 9
const COLUMN_COUNT_PER_SIDE = 4

const columnPositions = Array.from({ length: COLUMN_COUNT_PER_SIDE }, (_, i) => {
  const z = 6 - i * 6
  return [
    [-HALL_WIDTH / 2 + 1, HALL_HEIGHT / 2, z],
    [HALL_WIDTH / 2 - 1, HALL_HEIGHT / 2, z],
  ]
}).flat()

/**
 * Persistent architectural shell: floor, walls, structural columns.
 *
 * Materials and light levels here are a neutral "blockout" pass for
 * reviewing scale, composition, and spatial depth only — not the final
 * near-black tonal palette from creative-reference.md, and not the
 * Phase 1B lighting design (no directional light, shadows, or atmosphere
 * belong here). Tonal darkness is tuned once the real directional light
 * and exposure are introduced in Phase 1B.
 */
export default function Environment() {
  return (
    <group>
      <hemisphereLight args={['#ffffff', '#3a3a3a', 1.6]} />
      <ambientLight intensity={0.6} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, HALL_HEIGHT / 2, -HALL_DEPTH / 2]}>
        <planeGeometry args={[HALL_WIDTH, HALL_HEIGHT]} />
        <meshStandardMaterial color="#5c5c5c" roughness={0.95} metalness={0} />
      </mesh>

      {/* Side walls */}
      <mesh position={[-HALL_WIDTH / 2, HALL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[HALL_DEPTH, HALL_HEIGHT]} />
        <meshStandardMaterial color="#525252" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[HALL_WIDTH / 2, HALL_HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[HALL_DEPTH, HALL_HEIGHT]} />
        <meshStandardMaterial color="#525252" roughness={0.95} metalness={0} />
      </mesh>

      {/* Structural columns */}
      {columnPositions.map((position, i) => (
        <mesh key={i} position={position}>
          <boxGeometry args={[0.6, HALL_HEIGHT, 0.6]} />
          <meshStandardMaterial color="#6a6a6a" roughness={0.85} metalness={0.1} />
        </mesh>
      ))}
    </group>
  )
}
