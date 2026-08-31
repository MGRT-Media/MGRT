import * as THREE from 'three'
import { useMemo } from 'react'
import VolumetricLightingRig from './lighting/VolumetricLightingRig.jsx'
import { createStoneWallMaterial } from './materials/stoneWallMaterial.js'

const HALL_WIDTH = 14
const HALL_DEPTH = 32
const HALL_HEIGHT = 9

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

/**
 * Half-moon pillar arc framing the monitor, replacing the previous straight
 * two-sided colonnade. Semicircle opens toward the camera (+Z) so the
 * pillars read as layers of depth/parallax while scrolling forward along
 * -Z, with the monitor (at the spot-target x: 0.6, z: -3.5) sitting inside
 * the arc's "mouth." Center is placed just behind the monitor so the arc's
 * apex (the pillar furthest back) frames it from behind without any pillar
 * overlapping the monitor itself or the entrance pillars near the hero
 * start (z: 4, well outside the arc's z range).
 */
const ARC_PILLAR_COUNT = 7
const ARC_CENTER = [0, -4]
const ARC_RADIUS = 6.5
const ARC_SPAN_DEGREES = 160 // from -80° to +80°, symmetric around the back apex (0°)

const arcPillarPositions = Array.from({ length: ARC_PILLAR_COUNT }, (_, i) => {
  const t = ARC_PILLAR_COUNT === 1 ? 0 : i / (ARC_PILLAR_COUNT - 1)
  const angle = THREE.MathUtils.degToRad(-ARC_SPAN_DEGREES / 2 + t * ARC_SPAN_DEGREES)
  const x = ARC_CENTER[0] + ARC_RADIUS * Math.sin(angle)
  const z = ARC_CENTER[1] - ARC_RADIUS * Math.cos(angle)
  return [x, z]
})

/**
 * Entrance pillars — a foreground pair flanking the camera's hero start
 * ([0, 1.6, 9]) and the first leg of its path (which stays at x: 0 through
 * z: 9 → 5, per cameraPath.js). Placed close to center (unlike the arc
 * pillars, which stay well behind z: -4) so they read as a near-camera
 * "gateway" the eye — and the camera — passes through before reaching the
 * arc, distinct in role and scale from it.
 */
const entrancePillarPositions = [
  [-2.2, 4],
  [2.2, 4],
]

/**
 * Single window opening on the right side wall (x = +HALL_WIDTH/2), upper
 * portion — per creative-reference.md's own "strong directional sunlight
 * through high apertures" brief. Reduced from the previous 3-window band
 * (§4O) to just this one, per explicit request. Its position exactly
 * matches `volumetricLighting.js`'s repositioned `spot.position` (x: 6.85,
 * y: 6.3, z: -3) so the beam visually originates at the opening itself.
 */
const WINDOW = {
  width: 1.3,
  height: 3.2,
  centerY: 6.3,
  frameThickness: 0.07,
  frameDepth: 0.1,
  glassColor: '#fff6e2',
}
const windowZPositions = [-3]

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
 * `volumetricLighting.js`'s repositioned spot) a single window opening.
 *
 * Core room dimensions and overall layout are the approved Phase 1A
 * foundation. Column *layout* (the half-moon arc) and wall *material*
 * (procedural old stone) are deliberate revisions of that foundation —
 * see the Phase 1A entry in build-status.md §5. Lighting comes from the
 * Phase 1B system (`VolumetricLightingRig`). The stone material's `color`
 * tint still carries the existing three-tier tonality from
 * `SURFACE_TONE` (walls mid, floor darkest, multiplied with the
 * generated stone albedo) — that part of Phase 1B's approval is
 * preserved, not replaced.
 */
export default function Environment() {
  const columnGeometry = useColumnGeometry(HALL_HEIGHT)

  const wallBackMaterial = useMemo(() => createStoneWallMaterial(SURFACE_TONE.wallBack), [])
  // Cloning (rather than a second createStoneWallMaterial call) reuses the
  // same generated map/normalMap/roughnessMap textures instead of
  // re-running the noise generation a second time — only the tint color
  // differs, matching Phase 1B's existing wallBack/wallSide distinction.
  const wallSideMaterial = useMemo(() => {
    const material = wallBackMaterial.clone()
    material.color.set(SURFACE_TONE.wallSide)
    return material
  }, [wallBackMaterial])

  return (
    <group>
      <VolumetricLightingRig />

      {/* Floor — darkest tier */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH, 32, 64]} />
        <meshStandardMaterial color={SURFACE_TONE.floor} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Back wall — mid tier, old-stone PBR material */}
      <mesh position={[0, HALL_HEIGHT / 2, -HALL_DEPTH / 2]} material={wallBackMaterial} receiveShadow>
        <planeGeometry args={[HALL_WIDTH, HALL_HEIGHT]} />
      </mesh>

      {/* Side walls — mid tier, old-stone PBR material */}
      <mesh
        position={[-HALL_WIDTH / 2, HALL_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        material={wallSideMaterial}
        receiveShadow
      >
        <planeGeometry args={[HALL_DEPTH, HALL_HEIGHT]} />
      </mesh>
      <mesh
        position={[HALL_WIDTH / 2, HALL_HEIGHT / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        material={wallSideMaterial}
        receiveShadow
      >
        <planeGeometry args={[HALL_DEPTH, HALL_HEIGHT]} />
      </mesh>

      {/* Half-moon pillar arc — lightest tier, frames the monitor */}
      {arcPillarPositions.map(([x, z], i) => (
        <mesh key={`arc-${i}`} position={[x, 0, z]} geometry={columnGeometry} castShadow receiveShadow>
          <meshStandardMaterial color={SURFACE_TONE.column} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}

      {/* Entrance pillars — lightest tier, matches the side colonnade */}
      {entrancePillarPositions.map(([x, z], i) => (
        <mesh key={`entrance-${i}`} position={[x, 0, z]} geometry={columnGeometry} castShadow receiveShadow>
          <meshStandardMaterial color={SURFACE_TONE.column} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}

      {/* Window opening — right side wall, upper band */}
      {windowZPositions.map((z) => (
        <Window key={`window-${z}`} z={z} />
      ))}
    </group>
  )
}
