import { ROOM, TABLE } from './studioLayout.js'
import WallLettering from './WallLettering.jsx'
import ZoneGuides from './ZoneGuides.jsx'

/*
 * Blockout tones: neutral greys, far enough apart that the wall, the floor,
 * the table and the lettering each read as their own silhouette. They stand in
 * for materials and say nothing about them.
 */
const TONE = {
  floor: '#2b2b2b',
  rearWall: '#8f8f8f',
  sideWall: '#7c7c7c',
  ceiling: '#565656',
  tableTop: '#5a5a5a',
  tableLeg: '#3d3d3d',
}

const ROOM_CENTER_Z = (ROOM.rearWallZ + ROOM.frontWallZ) / 2

const LEG_HEIGHT = TABLE.height - TABLE.topThickness
const LEG_X = TABLE.width / 2 - TABLE.legInset
const LEG_Z = TABLE.depth / 2 - TABLE.legInset
const LEG_CORNERS = [
  [-LEG_X, -LEG_Z],
  [LEG_X, -LEG_Z],
  [-LEG_X, LEG_Z],
  [LEG_X, LEG_Z],
]

/** One blockout surface: the geometry passed as children, in a flat tone. */
function Surface({ tone, children, ...mesh }) {
  return (
    <mesh receiveShadow {...mesh}>
      {children}
      <meshStandardMaterial color={tone} roughness={0.92} />
    </mesh>
  )
}

/**
 * The studio as a BLOCKOUT: the room's shell, the table and the wordmark at
 * their real sizes and positions, in flat tones.
 *
 * Everything is placed from `studioLayout.js`. This is for judging proportion,
 * composition and framing; surfaces, detail and anything on the table come in
 * later phases. There is no front wall: the camera never looks back at it.
 */
export default function StudioRoom() {
  return (
    <group>
      <Surface tone={TONE.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROOM_CENTER_Z]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
      </Surface>
      <Surface tone={TONE.ceiling} rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM.height, ROOM_CENTER_Z]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
      </Surface>
      <Surface tone={TONE.rearWall} position={[0, ROOM.height / 2, ROOM.rearWallZ]}>
        <planeGeometry args={[ROOM.width, ROOM.height]} />
      </Surface>
      <Surface
        tone={TONE.sideWall}
        rotation={[0, Math.PI / 2, 0]}
        position={[-ROOM.width / 2, ROOM.height / 2, ROOM_CENTER_Z]}
      >
        <planeGeometry args={[ROOM.depth, ROOM.height]} />
      </Surface>
      <Surface
        tone={TONE.sideWall}
        rotation={[0, -Math.PI / 2, 0]}
        position={[ROOM.width / 2, ROOM.height / 2, ROOM_CENTER_Z]}
      >
        <planeGeometry args={[ROOM.depth, ROOM.height]} />
      </Surface>

      <WallLettering />

      <Surface tone={TONE.tableTop} position={[0, TABLE.height - TABLE.topThickness / 2, 0]} castShadow>
        <boxGeometry args={[TABLE.width, TABLE.topThickness, TABLE.depth]} />
      </Surface>
      {LEG_CORNERS.map(([x, z]) => (
        <Surface key={`${x},${z}`} tone={TONE.tableLeg} position={[x, LEG_HEIGHT / 2, z]} castShadow>
          <boxGeometry args={[TABLE.legThickness, LEG_HEIGHT, TABLE.legThickness]} />
        </Surface>
      ))}

      {/* TEMPORARY: marks the three collections' areas. Delete this line (and
          ZoneGuides.jsx) once the table is populated. */}
      <ZoneGuides />
    </group>
  )
}
