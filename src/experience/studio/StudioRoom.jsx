import { LETTERING, LETTERING_CENTER, ROOM, TABLE } from './studioLayout.js'

const LEG_HEIGHT = TABLE.height - TABLE.topThickness
const LEG_X = TABLE.width / 2 - TABLE.legInset
const LEG_Z = TABLE.depth / 2 - TABLE.legInset
const LEG_CORNERS = [
  [-LEG_X, -LEG_Z],
  [LEG_X, -LEG_Z],
  [-LEG_X, LEG_Z],
  [LEG_X, LEG_Z],
]

/**
 * PLACEHOLDER geometry: a floor, the back wall, a table and a slab where the
 * wordmark will hang, in flat colours.
 *
 * It exists so the camera stages, the lighting levels and the lens have
 * something to be checked against. It is built entirely from `studioLayout.js`
 * and is replaced by the real room in Phase 2 — nothing here is a design.
 */
export default function StudioRoom() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROOM.backWallZ + ROOM.depth / 2]} receiveShadow>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshStandardMaterial color="#3a3835" roughness={0.9} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, ROOM.wallHeight / 2, ROOM.backWallZ]} receiveShadow>
        <planeGeometry args={[ROOM.width, ROOM.wallHeight]} />
        <meshStandardMaterial color="#8a8279" roughness={0.95} />
      </mesh>

      {/* Lettering stand-in */}
      <mesh position={LETTERING_CENTER}>
        <boxGeometry args={[LETTERING.width, LETTERING.height, LETTERING.depth]} />
        <meshStandardMaterial color="#4a4038" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Table */}
      <mesh position={[0, TABLE.height - TABLE.topThickness / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[TABLE.width, TABLE.topThickness, TABLE.depth]} />
        <meshStandardMaterial color="#3b2a1f" roughness={0.6} />
      </mesh>
      {LEG_CORNERS.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, LEG_HEIGHT / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[TABLE.legThickness, LEG_HEIGHT, TABLE.legThickness]} />
          <meshStandardMaterial color="#2a1e16" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}
