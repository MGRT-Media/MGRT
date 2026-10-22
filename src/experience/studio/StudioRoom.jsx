import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildFloorGeometry, buildSurfaceGeometry, buildTableGeometry, buildWallGeometry } from './studioGeometry.js'
import { ROOM } from './studioLayout.js'
import {
  createCeilingMaterial,
  createFloorMaterial,
  createPlasterMaterial,
  createSteelMaterial,
  createStoneMaterial,
  createWalnutMaterial,
} from './studioMaterials.js'
import { LOOK } from './studioLook.js'
import WallLettering from './WallLettering.jsx'
import ZoneGuides from './ZoneGuides.jsx'

const ROOM_CENTER_Z = (ROOM.rearWallZ + ROOM.frontWallZ) / 2

// `?guides` on the URL shows the temporary outlines of the three table areas.
// Off by default, so review captures are of the room alone.
const SHOW_ZONE_GUIDES = new URLSearchParams(window.location.search).has('guides')

/**
 * What polished surfaces reflect: a small, blurred studio interior, built once
 * and never changed. It is given only to the materials that mirror the room
 * (`studioMaterials.js`) and is not the scene's environment, so it adds
 * highlights without becoming an ambient light on everything else.
 */
function useReflectionEnvironment() {
  const gl = useThree((state) => state.gl)
  const target = useMemo(() => {
    const generator = new THREE.PMREMGenerator(gl)
    const result = generator.fromScene(new RoomEnvironment(), 0.04)
    generator.dispose()
    return result
  }, [gl])
  useEffect(() => () => target.dispose(), [target])
  return target.texture
}

function useDisposable(build, dependencies) {
  const value = useMemo(build, dependencies)
  useEffect(() => () => value.dispose(), [value])
  return value
}

/**
 * The studio: plaster walls coved into a dark concrete floor, the stone table
 * and the wall lettering, at the proportions set in `studioLayout.js` and in the
 * finishes set in `studioLook.js`.
 *
 * There is no front wall: the camera never looks back at it. The ceiling is
 * never in frame either (`stageFraming.js`), but it is here, because without
 * it the lights would have nothing above them to keep the room dark.
 */
export default function StudioRoom() {
  const environment = useReflectionEnvironment()

  const plaster = useDisposable(() => createPlasterMaterial(), [])
  const floorMaterial = useDisposable(() => createFloorMaterial(), [])
  const ceilingMaterial = useDisposable(() => createCeilingMaterial(), [])
  // The top's material and the frame's: honed stone on blackened steel, or
  // (the earlier finish, kept) walnut throughout — see `LOOK.tableFinish`.
  const stoneTop = LOOK.tableFinish === 'stone'
  const topMaterial = useDisposable(
    () => (stoneTop ? createStoneMaterial(environment) : createWalnutMaterial(environment)),
    [environment],
  )
  const frameMaterial = useDisposable(
    () => (stoneTop ? createSteelMaterial(environment) : topMaterial),
    [environment, topMaterial],
  )

  const rearWall = useDisposable(() => buildWallGeometry(ROOM.width, ROOM.height, { seed: 11 }), [])
  const leftWall = useDisposable(() => buildWallGeometry(ROOM.depth, ROOM.height, { seed: 23, uvOffset: [3.1, 0.7] }), [])
  const rightWall = useDisposable(() => buildWallGeometry(ROOM.depth, ROOM.height, { seed: 37, uvOffset: [5.3, 0.4] }), [])
  const floor = useDisposable(() => buildFloorGeometry(ROOM.width, ROOM.depth), [])
  const ceiling = useDisposable(() => buildSurfaceGeometry(ROOM.width, ROOM.depth), [])
  const table = useMemo(() => buildTableGeometry(), [])
  useEffect(
    () => () => {
      table.top.dispose()
      table.frame.dispose()
    },
    [table],
  )

  return (
    <group>
      <mesh
        geometry={floor}
        material={floorMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, ROOM_CENTER_Z]}
        receiveShadow
      />
      <mesh
        geometry={ceiling}
        material={ceilingMaterial}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, ROOM.height, ROOM_CENTER_Z]}
      />
      <mesh geometry={rearWall} material={plaster} position={[0, ROOM.height / 2, ROOM.rearWallZ]} receiveShadow />
      <mesh
        geometry={leftWall}
        material={plaster}
        rotation={[0, Math.PI / 2, 0]}
        position={[-ROOM.width / 2, ROOM.height / 2, ROOM_CENTER_Z]}
        receiveShadow
      />
      <mesh
        geometry={rightWall}
        material={plaster}
        rotation={[0, -Math.PI / 2, 0]}
        position={[ROOM.width / 2, ROOM.height / 2, ROOM_CENTER_Z]}
        receiveShadow
      />

      <WallLettering environment={environment} />

      <mesh geometry={table.top} material={topMaterial} castShadow receiveShadow />
      <mesh geometry={table.frame} material={frameMaterial} castShadow receiveShadow />

      {SHOW_ZONE_GUIDES && <ZoneGuides />}
    </group>
  )
}
