import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { BILLBOARD_PLACEMENT } from './Billboard.jsx'
import {
  CARRIAGEWAY_HALF_WIDTH,
  LANE_WIDTH,
  ROAD_S_FAR,
  ROAD_S_NEAR,
  groundY,
  ribbonGeometry,
  roadFrame,
} from './highway.js'
import { distanceToRiver, terrainHeight } from './landscape.js'
import { EXTERIOR_LAYER, useExteriorLayer } from './layers.js'
import { createAsphaltMaterial, createTerrainMaterial, useGroundMaps } from './groundMaterials.js'
import {
  ENVIRONMENT_INTENSITY,
  FOG_DENSITY,
  SKY_ROTATION_Y,
  SUN_COLOR,
  SUN_DIRECTION,
  SUN_INTENSITY,
  exteriorAtmosphere,
} from './exteriorAtmosphere.js'
import { sampleCameraPath } from '../timeline/cameraPath.js'
import DaySky from './DaySky.jsx'
import River from './River.jsx'
import StreetLights from './StreetLights.jsx'

/**
 * The world the billboard turns out to be standing in: a four-lane highway
 * (two each way), gently curving away to the right, with the billboard on
 * its right-hand shoulder — per `experience-design.md` §9's Act 3
 * description — under the supplied daytime sky.
 *
 * Everything here is laid out against `BILLBOARD_PLACEMENT`, not against
 * hand-picked coordinates: `groundY` is the billboard's own bottom edge, so
 * the sign meets the road surface exactly, and the carriageway is offset
 * sideways from the billboard rather than positioned independently.
 *
 * The ground is one terrain mesh and a ring of distant hills sharing a single
 * blended material (`groundMaterials.js`): asphalt only on the road, earth
 * along its shoulders and the river banks, grass-covered ground beyond, and
 * the hills dissolving into the sky's own haze.
 *
 * The road's own geometry lives in `highway.js` — shared with
 * `StreetLights.jsx`, which places its columns on the same centreline this is
 * drawn from.
 */

const MARKING_HALF_WIDTH = 0.09

const GROUND_EXTENT = 520
const GROUND_SEGMENTS = 128

const revealPosition = new THREE.Vector3().fromArray(sampleCameraPath(1).position)

/**
 * The ground. One draw call and ~33k triangles for the whole landscape, with
 * the carriageway and riverbed already cut into it by `terrainHeight`. Each
 * vertex also carries its distance to the road centreline and to the river,
 * which is what the material's earth/grass blend is driven by.
 */
function buildTerrain() {
  const geometry = new THREE.PlaneGeometry(GROUND_EXTENT, GROUND_EXTENT, GROUND_SEGMENTS, GROUND_SEGMENTS)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.attributes.position
  const roadDistance = new Float32Array(position.count)
  const riverDistance = new Float32Array(position.count)
  const scratch = new THREE.Vector3()
  const centreZ = BILLBOARD_PLACEMENT.center[2]

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i) + centreZ
    position.setY(i, terrainHeight(x, z, scratch))

    const { s, lateral } = roadFrame(x, z, scratch)
    // Past either end of the drawn road the distance keeps growing along it
    // too, so the earth strip rounds off rather than running on without a road.
    const beyond = Math.max(s - ROAD_S_NEAR, ROAD_S_FAR - s, 0)
    roadDistance[i] = Math.hypot(lateral, beyond)
    riverDistance[i] = distanceToRiver(x, z)
  }
  geometry.setAttribute('aRoadDistance', new THREE.BufferAttribute(roadDistance, 1))
  geometry.setAttribute('aRiverDistance', new THREE.BufferAttribute(riverDistance, 1))
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Distant hills: three sloped bands ringing the view, each taller and further
 * than the one before. The profile is a layered sine, so it is deterministic.
 * They rise out of the terrain rather than standing on its edge — the toe of
 * each band is below ground level and inside the terrain's extent — so the
 * horizon has no gap and no seam where one surface ends. The scene haze gives
 * them their atmospheric depth.
 */
// Broad and low — slopes of roughly 10 to 20 degrees — so they read as rolling
// land rather than as walls, and the ground material's plan mapping stays
// unstretched on their faces.
const HILLS = [
  { radius: 205, minHeight: 5, maxHeight: 16, seed: 1.7 },
  { radius: 255, minHeight: 11, maxHeight: 27, seed: 4.1 },
  { radius: 305, minHeight: 20, maxHeight: 42, seed: 6.9 },
]
const HILL_SEGMENTS = 128
// Toe, shoulder and crest, as (fraction of the band's depth in toward the
// view, fraction of the crest height).
const HILL_ROWS = [
  [1, -0.12],
  [0.7, 0.28],
  [0.4, 0.68],
  [0.15, 0.93],
  [0, 1],
]
const HILL_DEPTH = 95

function buildHills() {
  const positions = []
  const indices = []
  let offset = 0
  const rows = HILL_ROWS.length

  HILLS.forEach(({ radius, minHeight, maxHeight, seed }) => {
    for (let i = 0; i <= HILL_SEGMENTS; i += 1) {
      const angle = (i / HILL_SEGMENTS) * Math.PI * 2
      const profile =
        0.5 +
        0.3 * Math.sin(angle * 3 + seed) +
        0.16 * Math.sin(angle * 7 + seed * 2.3) +
        0.08 * Math.sin(angle * 13 + seed * 0.7)
      const crest = THREE.MathUtils.lerp(minHeight, maxHeight, THREE.MathUtils.clamp(profile, 0, 1))
      HILL_ROWS.forEach(([inward, heightFraction], row) => {
        // Slopes and spurs: each row is pushed in or out and up or down by
        // its own sine terms, so the face is folded rather than a smooth
        // plateau wall. Nothing moves at the toe, which stays underground.
        const fold = row === 0 ? 0 : Math.sin(angle * 11 + seed * 3 + row) * 0.5 + Math.sin(angle * 23 + seed + row * 2) * 0.3
        const r = radius - inward * HILL_DEPTH + fold * 14
        const height = crest * heightFraction * (1 + fold * 0.14 * (row / (HILL_ROWS.length - 1)))
        positions.push(
          revealPosition.x + Math.cos(angle) * r,
          groundY + height,
          revealPosition.z + Math.sin(angle) * r,
        )
      })
      if (i < HILL_SEGMENTS) {
        for (let row = 0; row < rows - 1; row += 1) {
          const a = offset + i * rows + row
          const b = a + rows
          // Wound so the faces point inward and up, toward the view.
          indices.push(a, b, a + 1, a + 1, b, b + 1)
        }
      }
    }
    offset += (HILL_SEGMENTS + 1) * rows
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  // Far from every road and river: the blend resolves to grass-covered ground.
  const far = new Float32Array(positions.length / 3).fill(1e4)
  geometry.setAttribute('aRoadDistance', new THREE.BufferAttribute(far, 1))
  geometry.setAttribute('aRiverDistance', new THREE.BufferAttribute(far.slice(), 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const ROAD_SEGMENTS = 340

/**
 * The override materials the post chain renders the scene with — GTAO's
 * normals, and the depth-of-field and focus depth passes — for the warm-up
 * render below. Kept for the page's lifetime on purpose: disposing a material
 * releases its compiled program as soon as nothing else uses it, which would
 * throw away exactly the variants the warm-up exists to build.
 */
let warmOverrides = null

function Ribbon({ material, ...options }) {
  const geometry = useMemo(() => ribbonGeometry({ segments: ROAD_SEGMENTS, ...options }), [JSON.stringify(options)])
  return <mesh geometry={geometry} material={material} receiveShadow />
}

/** Road paint: lit like the road it is on, and held just in front of it. */
function paintMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })
}

/**
 * The sun, aligned with the sky's own (`exteriorAtmosphere.js`), casting the
 * exterior's shadows. The shadow frustum covers the ground the reveal actually
 * looks at — the billboard, the near carriageway and the columns along it —
 * rather than the whole landscape, which is what keeps 2048 texels sharp.
 * Shadow casters are whatever the camera's layer shows, so this pass only ever
 * contains exterior objects, and it does not run while the room is on screen.
 */
const SHADOW_CENTRE = new THREE.Vector3(-8, groundY, -12)
const SHADOW_HALF_EXTENT = 95

function useSunLight() {
  return useMemo(() => {
    const light = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY)
    light.position.copy(SHADOW_CENTRE).addScaledVector(SUN_DIRECTION, 160)
    light.target.position.copy(SHADOW_CENTRE)
    light.castShadow = true
    light.shadow.mapSize.set(2048, 2048)
    Object.assign(light.shadow.camera, {
      left: -SHADOW_HALF_EXTENT,
      right: SHADOW_HALF_EXTENT,
      top: SHADOW_HALF_EXTENT,
      bottom: -SHADOW_HALF_EXTENT,
      near: 10,
      far: 330,
    })
    light.shadow.camera.updateProjectionMatrix()
    light.shadow.bias = -0.0004
    light.shadow.normalBias = 0.04
    return light
  }, [])
}

export default function ExteriorEnvironment() {
  const applyExteriorLayer = useExteriorLayer()
  const { gl, scene, camera } = useThree()
  const maps = useGroundMaps()
  const terrainGeometry = useMemo(buildTerrain, [])
  const hillsGeometry = useMemo(buildHills, [])
  const terrainMaterial = useMemo(() => createTerrainMaterial(maps), [maps])
  const asphaltMaterial = useMemo(() => createAsphaltMaterial(maps, CARRIAGEWAY_HALF_WIDTH), [maps])
  const whitePaint = useMemo(() => paintMaterial('#d9d6cc'), [])
  const yellowPaint = useMemo(() => paintMaterial('#cfae5c'), [])
  const sun = useSunLight()

  // One real exterior render, offscreen, on the held Digital frame this mounts
  // on. Measured: without it the first exterior frame — the swap itself — spent
  // ~2s compiling 18 programs (the ground, the billboard's materials, the sun's
  // shadow depth passes). A compile call alone did not prevent that, because
  // the program variants depend on the lights, shadows, environment and fog
  // actually in force, so this renders with all of them set exactly as the
  // exterior will have them, then puts the room's back. Nothing is displayed.
  // It repeats the render under the override materials the post chain swaps in
  // (the ambient-occlusion normals, and the depth-of-field and focus depth
  // passes), whose variants for these objects would otherwise compile at the
  // swap too.
  useEffect(() => {
    const exteriorCamera = camera.clone()
    exteriorCamera.layers.set(EXTERIOR_LAYER)
    exteriorCamera.position.copy(revealPosition)
    exteriorCamera.far = 400
    exteriorCamera.updateProjectionMatrix()

    const room = {
      environment: scene.environment,
      environmentIntensity: scene.environmentIntensity,
      environmentRotationY: scene.environmentRotation.y,
      fogDensity: scene.fog?.density,
      fogColor: scene.fog?.color.clone(),
    }
    scene.environment = exteriorAtmosphere.environment
    scene.environmentIntensity = ENVIRONMENT_INTENSITY
    scene.environmentRotation.y = SKY_ROTATION_Y
    if (scene.fog) {
      scene.fog.density = FOG_DENSITY
      scene.fog.color.copy(exteriorAtmosphere.fogColor)
    }

    const warmTarget = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType })
    const previousTarget = gl.getRenderTarget()
    gl.setRenderTarget(warmTarget)
    gl.render(scene, exteriorCamera)
    // `NoBlending`, as the passes set it: blending is part of a program's
    // variant, so a default-blended copy compiles a program nothing uses.
    warmOverrides ??= [
      new THREE.MeshNormalMaterial({ blending: THREE.NoBlending }),
      new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, blending: THREE.NoBlending }),
      new THREE.MeshDepthMaterial({ blending: THREE.NoBlending }),
    ]
    const previousOverride = scene.overrideMaterial
    warmOverrides.forEach((override) => {
      scene.overrideMaterial = override
      gl.render(scene, exteriorCamera)
    })
    scene.overrideMaterial = previousOverride
    gl.setRenderTarget(previousTarget)
    warmTarget.dispose()

    scene.environment = room.environment
    scene.environmentIntensity = room.environmentIntensity
    scene.environmentRotation.y = room.environmentRotationY
    if (scene.fog) {
      scene.fog.density = room.fogDensity
      scene.fog.color.copy(room.fogColor)
    }
  }, [gl, scene, camera])

  return (
    <group ref={applyExteriorLayer}>
      <mesh
        geometry={terrainGeometry}
        material={terrainMaterial}
        position={[0, groundY, BILLBOARD_PLACEMENT.center[2]]}
        receiveShadow
      />
      <mesh geometry={hillsGeometry} material={terrainMaterial} frustumCulled={false} />

      <Ribbon material={asphaltMaterial} halfWidth={CARRIAGEWAY_HALF_WIDTH} lift={0.012} />

      {/* Solid edge lines at the outside of each carriageway, a broken line
          between the two lanes of each direction, and the centre line
          separating the opposing carriageways — the marking pattern that
          makes "four lanes, two each way" readable at a glance. */}
      <Ribbon material={whitePaint} halfWidth={MARKING_HALF_WIDTH} offset={-CARRIAGEWAY_HALF_WIDTH + 0.25} lift={0.02} />
      <Ribbon material={whitePaint} halfWidth={MARKING_HALF_WIDTH} offset={CARRIAGEWAY_HALF_WIDTH - 0.25} lift={0.02} />
      <Ribbon material={whitePaint} halfWidth={MARKING_HALF_WIDTH} offset={-LANE_WIDTH} lift={0.02} dashLength={3} gapLength={5} />
      <Ribbon material={whitePaint} halfWidth={MARKING_HALF_WIDTH} offset={LANE_WIDTH} lift={0.02} dashLength={3} gapLength={5} />
      <Ribbon material={yellowPaint} halfWidth={MARKING_HALF_WIDTH * 1.4} offset={0} lift={0.02} />

      <River />
      <StreetLights />
      <DaySky />

      {/* The only direct light outside; the sky's environment lighting
          (applied by `CampaignsLayerSwitch`) fills the shade. Layer-assigned
          with everything else, so neither ever lights the room. */}
      <primitive object={sun} />
      <primitive object={sun.target} />
    </group>
  )
}
