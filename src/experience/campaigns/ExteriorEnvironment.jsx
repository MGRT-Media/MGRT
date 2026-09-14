import { useMemo } from 'react'
import * as THREE from 'three'
import { BILLBOARD_PLACEMENT } from './Billboard.jsx'
import {
  CARRIAGEWAY_HALF_WIDTH,
  LANE_WIDTH,
  SHOULDER_WIDTH,
  groundY,
  ribbonGeometry,
} from './highway.js'
import { terrainHeight } from './landscape.js'
import { useExteriorLayer } from './layers.js'
import NightSky from './NightSky.jsx'
import River from './River.jsx'
import StreetLights from './StreetLights.jsx'

/**
 * The world the billboard turns out to be standing in: a four-lane highway
 * (two each way), gently curving away to the right, with the billboard on
 * its right-hand shoulder — per `experience-design.md` §9's Act 3
 * description.
 *
 * Everything here is laid out against `BILLBOARD_PLACEMENT`, not against
 * hand-picked coordinates: `groundY` is the billboard's own bottom edge, so
 * the sign meets the road surface exactly, and the carriageway is offset
 * sideways from the billboard rather than positioned independently. Change
 * the billboard's placement and the road follows it.
 *
 * Deliberately restrained — no cityscape, no props. The reveal's subject is
 * the recontextualisation itself; the environment only has to make the
 * billboard's scale and situation legible, and read as continuing past the
 * frame. Distance is still handled by the scene's exponential fog rather
 * than by modelling a horizon; `NightSky.jsx` now grades a dome behind that
 * haze so it resolves into a sky rather than into the canvas's own flat
 * background.
 *
 * The road's own geometry lives in `highway.js` — shared with
 * `StreetLights.jsx`, which places its columns on the same centreline this is
 * drawn from.
 */

// Only the painted lines use this, so it stays here rather than moving to
// `highway.js` with the layout constants.
const MARKING_HALF_WIDTH = 0.09

// Surface tones deliberately close to the interior's own `SURFACE_TONE`
// range (Environment.jsx) — the ground first becomes visible immediately
// after the swap, and keeping it in the same greyscale family means the
// reveal reads as a change of context, not a change of palette.
// Desert sand under moonlight: warm in hue but heavily desaturated, because
// at these light levels the eye takes almost no colour from it. Crests read
// slightly paler than troughs, which is what gives the dunes their form
// without needing a texture.
const SAND_LOW = new THREE.Color('#211d19')
const SAND_HIGH = new THREE.Color('#3a332b')

const GROUND_EXTENT = 520
const GROUND_SEGMENTS = 128

/**
 * The desert floor. One draw call and ~33k triangles for the whole
 * landscape, with the carriageway and riverbed already cut into it by
 * `terrainHeight` — so the road lies flat in its own corridor and the river
 * has a bed, rather than either being laid on top of dunes that ignore them.
 */
function buildDesert() {
  const geometry = new THREE.PlaneGeometry(GROUND_EXTENT, GROUND_EXTENT, GROUND_SEGMENTS, GROUND_SEGMENTS)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()
  const scratch = new THREE.Vector3()
  const centreZ = BILLBOARD_PLACEMENT.center[2]

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i) + centreZ
    const height = terrainHeight(x, z, scratch)
    position.setY(i, height)
    color.copy(SAND_LOW).lerp(SAND_HIGH, THREE.MathUtils.smoothstep(height, -1.2, 2.6))
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

const TONE = {
  asphalt: '#333338',
  shoulder: '#3d3d40',
  marking: '#c8c4b4',
  centreMarking: '#c9b273',
}

/** One ribbon mesh — unlit, so the road reads consistently at the distances this act works at. */
const ROAD_SEGMENTS = 340

function Ribbon({ color, ...options }) {
  const geometry = useMemo(() => ribbonGeometry({ segments: ROAD_SEGMENTS, ...options }), [JSON.stringify(options)])
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  )
}

export default function ExteriorEnvironment() {
  const applyExteriorLayer = useExteriorLayer()
  const desertGeometry = useMemo(buildDesert, [])

  return (
    <group ref={applyExteriorLayer}>
      {/* The desert floor, centred on the billboard's own Z so the visible
          spread is symmetric about the subject and large enough that its
          edges stay inside the camera's exterior far plane
          (CampaignsLayerSwitch.jsx) while sitting far past the distance the
          scene fog fully saturates at — so it resolves into a hazy horizon
          rather than ending at a visible seam. Lit, unlike the road ribbons
          below, which is what lets the dunes shade and read as terrain
          instead of one flat value. */}
      <mesh geometry={desertGeometry} position={[0, groundY, BILLBOARD_PLACEMENT.center[2]]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>

      <Ribbon color={TONE.shoulder} halfWidth={CARRIAGEWAY_HALF_WIDTH + SHOULDER_WIDTH} lift={0.006} />
      <Ribbon color={TONE.asphalt} halfWidth={CARRIAGEWAY_HALF_WIDTH} lift={0.012} />

      {/* Solid edge lines at the outside of each carriageway, a broken line
          between the two lanes of each direction, and the centre line
          separating the opposing carriageways — the marking pattern that
          makes "four lanes, two each way" readable at a glance. */}
      <Ribbon color={TONE.marking} halfWidth={MARKING_HALF_WIDTH} offset={-CARRIAGEWAY_HALF_WIDTH + 0.25} lift={0.02} />
      <Ribbon color={TONE.marking} halfWidth={MARKING_HALF_WIDTH} offset={CARRIAGEWAY_HALF_WIDTH - 0.25} lift={0.02} />
      <Ribbon color={TONE.marking} halfWidth={MARKING_HALF_WIDTH} offset={-LANE_WIDTH} lift={0.02} dashLength={3} gapLength={5} />
      <Ribbon color={TONE.marking} halfWidth={MARKING_HALF_WIDTH} offset={LANE_WIDTH} lift={0.02} dashLength={3} gapLength={5} />
      <Ribbon color={TONE.centreMarking} halfWidth={MARKING_HALF_WIDTH * 1.4} offset={0} lift={0.02} />

      <River />
      <StreetLights />
      <NightSky />

      {/* Exterior lighting, layer-assigned like every other object here:
          Three intersects light layers against object layers, so without
          this these would also light the interior room that Act 3 is busy
          showing on the billboard. Low and cool — the billboard is the lit
          element in this world, not the sky. */}
      <ambientLight intensity={0.55} color="#8f9aa8" />
      <directionalLight position={[-30, 26, 40]} intensity={0.5} color="#aab6c4" />
    </group>
  )
}
