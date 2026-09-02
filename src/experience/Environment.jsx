import * as THREE from 'three'
import { useMemo } from 'react'
import VolumetricLightingRig from './lighting/VolumetricLightingRig.jsx'
import { createStoneWallMaterial, stoneRepeatForSize } from './materials/stoneWallMaterial.js'

// Widened/deepened (14x32 -> 20x38) per explicit request: the previous
// dimensions left almost no room for a genuine wide establishing orbit
// outside the pillar ring — §4BD's exterior orbit was already pushed to
// 6.9, a mere 0.1 from these old ±7 walls. "If the existing room is too
// small... increase the room dimensions... preserve the existing
// architectural proportions" — the production ensemble itself
// (`BEAM_CENTER`/`Monitor.jsx`/`CinemaCamera.jsx`) is untouched, at its
// same absolute position; only the surrounding architecture grows around
// it, which is also what gives the pillar ring (below) room to grow too.
const HALL_WIDTH = 20
const HALL_DEPTH = 38
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
 * Full circular pillar ring — replaces the previous half-moon arc PLUS a
 * separate foreground "entrance pillar" pair, per explicit request: "the
 * room should contain one complete circular ring of pillars... there
 * should not be a separate pair of pillars specifically placed behind the
 * user's starting position... the circle itself is the architecture."
 *
 * `PILLAR_RING_CENTER`/`PILLAR_RING_RADIUS` are exported so
 * `cameraPath.js`'s new exterior-orbit entrance can derive its own path
 * (and the exact gap it enters through) from this ring's real geometry
 * rather than a second, independently guessed set of numbers — the same
 * "use the project's actual positions" principle already applied to the
 * Cinema Camera/Monitor anchors.
 *
 * Radius raised again, 4.6 -> 5.5, alongside this round's `HALL_WIDTH`/
 * `HALL_DEPTH` increase (see those constants' own comment) — the same
 * "far + low + wide" request that's been the throughline of every recent
 * camera-path round finally gets real room to work in: with the wider
 * hall, `cameraPath.js`'s exterior `ORBIT_RADIUS` no longer has to sit a
 * bare 0.1 from the walls to be "far from the pillars" — see that file's
 * own comment for the new numbers.
 *
 * 12 pillars at exactly 30° apart (unchanged spacing philosophy from the
 * previous arc's ~26.7°) is also a deliberate number: it happens to place
 * a natural gap close to the Cinema Camera lens's own real optical axis
 * (see `cameraPath.js`'s gate-angle derivation) — the "gate" the entrance
 * path enters through is a genuine gap this arrangement already has, not
 * an invented doorway cut into the ring.
 */
export const PILLAR_RING_CENTER = [0, -4]
export const PILLAR_RING_RADIUS = 5.5
export const PILLAR_COUNT = 12

const pillarPositions = Array.from({ length: PILLAR_COUNT }, (_, i) => {
  const angle = THREE.MathUtils.degToRad((360 / PILLAR_COUNT) * i)
  const x = PILLAR_RING_CENTER[0] + PILLAR_RING_RADIUS * Math.sin(angle)
  const z = PILLAR_RING_CENTER[1] - PILLAR_RING_RADIUS * Math.cos(angle)
  return [x, z]
})

/**
 * Organic breach in the right side wall (x = +HALL_WIDTH/2) — replaces the
 * previous structured window frame (§4O/§4P) with a jagged opening, as if
 * a section of stone collapsed away, per explicit request. Its center
 * exactly matches `volumetricLighting.js`'s `spot.position` (x: 6.85,
 * y: 6.3, z: -3) so the beam visually originates from inside the breach.
 *
 * `panelWidthZ` is the width (along world Z) of the dedicated wall panel
 * that contains the hole — the right wall is split into this panel plus
 * two plain flanking segments (front/back) covering the rest of its
 * length, since punching an actual opening requires real geometry, not
 * just an overlaid bright plane (see `Breach` and `stoneRepeatForSize`
 * call sites in `Environment`).
 */
const BREACH = {
  centerZ: -3,
  centerY: 6.3,
  panelWidthZ: 4,
  holeRadiusZ: 1.05,
  holeRadiusY: 1.85,
  depth: 0.2,
}

/** Deterministic hash, matching the approach already used in stoneWallMaterial.js. */
function hash1D(n) {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

/**
 * An irregular, fractured hole outline: a base ellipse perturbed by two
 * low-frequency sine harmonics (broad lobes/bites, like real fracture
 * planes) plus fine per-point jitter — rather than pure per-vertex random
 * noise, which tends to read as a spiky star instead of broken stone.
 */
function buildFractureOutline(radiusZ, radiusY, pointCount = 18) {
  const points = []
  for (let i = 0; i < pointCount; i += 1) {
    const t = (i / pointCount) * Math.PI * 2
    const lobes = 1 + 0.16 * Math.sin(3 * t + 0.6) + 0.12 * Math.sin(5 * t + 2.1)
    const jitter = 1 + (hash1D(i * 3.7 + 11) - 0.5) * 0.3
    const r = lobes * jitter
    points.push(new THREE.Vector2(Math.cos(t) * radiusZ * r, Math.sin(t) * radiusY * r))
  }
  return points
}

/**
 * Wall panel geometry containing the breach: a flat rectangle (matching
 * the wall's own thickness-less plane convention elsewhere, extruded only
 * enough to give the fractured edge real depth) with the fracture outline
 * cut out as a `Shape` hole. Local coordinates are centered like the
 * existing wall planes (position marks the center), so it drops into the
 * same `position`/`rotation` pattern as the other wall meshes.
 */
function useBreachGeometry() {
  return useMemo(() => {
    const halfW = BREACH.panelWidthZ / 2
    const halfH = HALL_HEIGHT / 2
    const holeCenterY = BREACH.centerY - HALL_HEIGHT / 2

    const outer = new THREE.Shape()
    outer.moveTo(-halfW, -halfH)
    outer.lineTo(halfW, -halfH)
    outer.lineTo(halfW, halfH)
    outer.lineTo(-halfW, halfH)
    outer.lineTo(-halfW, -halfH)

    const outline = buildFractureOutline(BREACH.holeRadiusZ, BREACH.holeRadiusY).map(
      (p) => new THREE.Vector2(p.x, p.y + holeCenterY),
    )
    outer.holes.push(new THREE.Path(outline))

    const geometry = new THREE.ExtrudeGeometry(outer, { depth: BREACH.depth, bevelEnabled: false })
    geometry.translate(0, 0, -BREACH.depth / 2)
    geometry.computeVertexNormals()
    return geometry
  }, [])
}

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
 * The breach wall panel — the stone material, with the fracture shape cut
 * as a genuine geometric hole (see `useBreachGeometry`). No separate
 * "glow pane" is layered into the opening: a flat rectangle couldn't match
 * the jagged outline without either falling short of it (leaving a visible
 * gap to the stone edge) or overflowing onto the surrounding solid stone.
 * The opening reading as lit comes from what's genuinely visible through
 * it — the beam mesh's own bright apex (already established, unchanged)
 * sits right at this location, and the fill/ambient light increases from
 * this round keep the fractured edges themselves from going pitch black.
 */
function Breach({ material }) {
  const geometry = useBreachGeometry()
  const wallX = HALL_WIDTH / 2

  return (
    <mesh
      position={[wallX, HALL_HEIGHT / 2, BREACH.centerZ]}
      rotation={[0, -Math.PI / 2, 0]}
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
    />
  )
}

// Right wall is split around the breach into a front segment (nearer the
// camera's hero start, +Z side) and a back segment (-Z side), covering
// the rest of the wall's full HALL_DEPTH length.
const rightFrontZ = {
  center: (BREACH.centerZ + BREACH.panelWidthZ / 2 + HALL_DEPTH / 2) / 2,
  width: HALL_DEPTH / 2 - (BREACH.centerZ + BREACH.panelWidthZ / 2),
}
const rightBackZ = {
  center: (-HALL_DEPTH / 2 + BREACH.centerZ - BREACH.panelWidthZ / 2) / 2,
  width: BREACH.centerZ - BREACH.panelWidthZ / 2 + HALL_DEPTH / 2,
}

/**
 * Persistent architectural shell: floor, walls, structural columns, and
 * (as of the window/relighting revision — see `Breach` and
 * `volumetricLighting.js`'s repositioned spot) a fractured wall opening.
 *
 * Core room dimensions and overall layout are the approved Phase 1A
 * foundation. Column *layout* (now a full ring — see `pillarPositions`
 * above) and wall *material* (procedural old stone) are deliberate
 * revisions of that foundation —
 * see the Phase 1A entry in build-status.md §5. Lighting comes from the
 * Phase 1B system (`VolumetricLightingRig`). The stone material's `color`
 * tint still carries the existing three-tier tonality from
 * `SURFACE_TONE` (walls mid, floor darkest, multiplied with the
 * generated stone albedo) — that part of Phase 1B's approval is
 * preserved, not replaced.
 *
 * Each wall segment gets its own `createStoneWallMaterial` call (rather
 * than sharing one cloned texture set, as an earlier round did) so its
 * `repeat` can be derived from that segment's own physical size via
 * `stoneRepeatForSize` — keeping the stone block scale consistent
 * relative to the pillars across every wall, including the two new right-
 * wall segments the breach split off. The extra noise-texture generation
 * this costs is a one-time mount cost (five materials × three 256×256
 * DataTextures), not a per-frame one — confirmed via frame-timing after.
 */
export default function Environment() {
  const columnGeometry = useColumnGeometry(HALL_HEIGHT)

  const wallBackMaterial = useMemo(
    () => createStoneWallMaterial(SURFACE_TONE.wallBack, stoneRepeatForSize(HALL_WIDTH, HALL_HEIGHT)),
    [],
  )
  const wallLeftMaterial = useMemo(
    () => createStoneWallMaterial(SURFACE_TONE.wallSide, stoneRepeatForSize(HALL_DEPTH, HALL_HEIGHT)),
    [],
  )
  const wallRightFrontMaterial = useMemo(
    () => createStoneWallMaterial(SURFACE_TONE.wallSide, stoneRepeatForSize(rightFrontZ.width, HALL_HEIGHT)),
    [],
  )
  const wallRightBackMaterial = useMemo(
    () => createStoneWallMaterial(SURFACE_TONE.wallSide, stoneRepeatForSize(rightBackZ.width, HALL_HEIGHT)),
    [],
  )
  const breachMaterial = useMemo(
    () => createStoneWallMaterial(SURFACE_TONE.wallSide, stoneRepeatForSize(BREACH.panelWidthZ, HALL_HEIGHT)),
    [],
  )

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

      {/* Left side wall — mid tier, old-stone PBR material, unsplit */}
      <mesh
        position={[-HALL_WIDTH / 2, HALL_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        material={wallLeftMaterial}
        receiveShadow
      >
        <planeGeometry args={[HALL_DEPTH, HALL_HEIGHT]} />
      </mesh>

      {/* Right side wall — split around the breach into front/back segments */}
      <mesh
        position={[HALL_WIDTH / 2, HALL_HEIGHT / 2, rightFrontZ.center]}
        rotation={[0, -Math.PI / 2, 0]}
        material={wallRightFrontMaterial}
        receiveShadow
      >
        <planeGeometry args={[rightFrontZ.width, HALL_HEIGHT]} />
      </mesh>
      <mesh
        position={[HALL_WIDTH / 2, HALL_HEIGHT / 2, rightBackZ.center]}
        rotation={[0, -Math.PI / 2, 0]}
        material={wallRightBackMaterial}
        receiveShadow
      >
        <planeGeometry args={[rightBackZ.width, HALL_HEIGHT]} />
      </mesh>
      <Breach material={breachMaterial} />

      {/* Full pillar ring — lightest tier, surrounds the production space */}
      {pillarPositions.map(([x, z], i) => (
        <mesh key={`pillar-${i}`} position={[x, 0, z]} geometry={columnGeometry} castShadow receiveShadow>
          <meshStandardMaterial color={SURFACE_TONE.column} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
    </group>
  )
}
