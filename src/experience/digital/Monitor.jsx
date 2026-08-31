import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { lightingParams } from '../lighting/volumetricLighting.js'
import { createScreenTestPatternMaterial } from './screenTestPatternMaterial.js'
import { createStoneWallMaterial } from '../materials/stoneWallMaterial.js'

// A dynamic, off-square yaw rather than facing dead-center forward, per
// explicit request. Rotating around the group's own origin (the cart's
// floor position, MONITOR_ANCHOR.position) means the screen's actual
// world-space center shifts slightly (it's offset from that origin along
// local +Z by screenFrontZ, so the rotation sweeps it through a small
// arc — up to roughly screenFrontZ * sin(20°) ≈ 0.1 world units in X/Z).
// `cameraPath.js`'s monitor-aligned shot is deliberately NOT recomputed
// to chase this small shift — MONITOR_ANCHOR/MONITOR_ALIGNED_POSITION is
// a long-established, load-bearing derivation this session has never
// touched, and reworking it to account for a rotated screen normal would
// be a much larger, riskier change for a sub-0.1-unit correction. The
// final approach reads slightly off-axis rather than perfectly square as
// a result — left as-is deliberately, since it's consistent with (not a
// bug relative to) this same request's "dynamic, angled" intent for the
// whole approach, not just the monitor mesh. Verified visually, not just
// assumed acceptable.
const MONITOR_YAW_DEGREES = 20

/**
 * Provisional Phase 1D monitor geometry — a retro/mid-century industrial
 * reference-monitor console, standing on a stone plinth within the
 * Phase 1B beam's floor target. Not the final Digital composition (that's
 * Phase 2, per build-workflow.md §10).
 *
 * The support was originally a retro AV-cart (four legs + a thin metal
 * platform), then a clean `RoundedBoxGeometry` monolith; now a raw,
 * naturally-broken stone block (`buildRockGeometry`, below) per explicit
 * request for organic/irregular geometry rather than a primitive-shaped
 * placeholder — jagged sides and a flat, undisplaced top plateau sized to
 * the monitor's own footprint, so it still sits genuinely (not just
 * approximately) grounded. Uses the same procedural stone material as the
 * walls (`stoneWallMaterial.js`) for the material-language match, applied
 * to the rock's own UVs unchanged from the source `BoxGeometry`.
 *
 * `screenCenterHeight` is computed from the console's actual stacked
 * dimensions below (plinth height + housing offset), not hand-picked — it
 * lands close to the previous cart-supported value by construction of
 * realistic proportions, and `cameraPath.js` re-derives its monitor-aligned
 * shot from whatever this value actually is, so the two stay in sync
 * automatically if the console's proportions change again later.
 */
const PLINTH = {
  width: 1.0,
  depth: 0.75,
  height: 0.72,
}

/** Deterministic 3D hash, matching the approach already used in stoneWallMaterial.js. */
function hash3(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return s - Math.floor(s)
}

/**
 * A raw, naturally-broken stone block: a subdivided `BoxGeometry` with each
 * vertex displaced outward by layered noise, EXCEPT vertices at or near the
 * exact top face — those are left undisplaced, so the monitor always has a
 * genuinely flat plane to sit on no matter how the noise seed shakes out,
 * rather than a "probably flat enough" approximation. The falloff is a
 * smooth blend (not a hard cutoff), so the flat plateau eases into the
 * jagged sides rather than showing a visible seam.
 *
 * `BoxGeometry` gives each face its own vertex copies at shared edges/
 * corners (so normals stay correct per-face), but since the hash is a
 * pure function of position, coincident vertices at an edge get identical
 * displacement — the mesh stays watertight, no cracks open up at the
 * corners despite the per-face vertex duplication.
 */
function buildRockGeometry(width, height, depth) {
  const segments = 6
  const geometry = new THREE.BoxGeometry(width, height, depth, segments, segments, segments)
  const pos = geometry.attributes.position
  const halfH = height / 2
  const maxJag = Math.min(width, depth) * 0.22

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)

    // 0 well below the top, ramping to 1 right at the exact top face —
    // vertices at topFactor 1 get zero displacement (the flat plateau).
    const topFactor = THREE.MathUtils.smoothstep(y, halfH * 0.35, halfH * 0.98)
    if (topFactor >= 1) continue

    const n1 = hash3(x * 3.1, y * 3.1, z * 3.1)
    const n2 = hash3(x * 7.7 + 11, y * 7.7 + 11, z * 7.7 + 11) * 0.5
    const bump = (n1 + n2 - 0.75) * maxJag * (1 - topFactor)

    const dir = new THREE.Vector3(x, y, z)
    const len = dir.length() || 1
    dir.multiplyScalar(bump / len)
    pos.setXYZ(i, x + dir.x, y + dir.y, z + dir.z)
  }

  geometry.computeVertexNormals()
  return geometry
}

const HOUSING = {
  width: 1.15,
  height: 0.85,
  frontDepth: 0.55,
  rearWidth: 0.8,
  rearHeight: 0.6,
  rearDepth: 0.42,
  cornerRadius: 0.05,
}

const BEZEL = {
  side: 0.13,
  top: 0.12,
  bottom: 0.22,
}

const plinthTopY = PLINTH.height
const housingCenterY = plinthTopY + HOUSING.height / 2
const screenWidth = HOUSING.width - BEZEL.side * 2
const screenHeight = HOUSING.height - BEZEL.top - BEZEL.bottom
// Bottom bezel is deliberately taller (control-panel area), so the screen
// itself sits slightly above the housing's own vertical center.
const screenCenterOffset = (BEZEL.bottom - BEZEL.top) / 2

export const MONITOR_ANCHOR = {
  position: lightingParams.spot.target,
  screenWidth,
  screenHeight,
  screenCenterHeight: housingCenterY + screenCenterOffset,
}

const screenFrontZ = HOUSING.frontDepth / 2 + 0.002
const glassFrontZ = screenFrontZ + 0.004

export default function Monitor() {
  const screenMaterial = useMemo(() => createScreenTestPatternMaterial(), [])

  const housingGeometry = useMemo(
    () => new RoundedBoxGeometry(HOUSING.width, HOUSING.height, HOUSING.frontDepth, 3, HOUSING.cornerRadius),
    [],
  )
  const rearHumpGeometry = useMemo(
    () => new RoundedBoxGeometry(HOUSING.rearWidth, HOUSING.rearHeight, HOUSING.rearDepth, 3, HOUSING.cornerRadius),
    [],
  )
  const plinthGeometry = useMemo(() => buildRockGeometry(PLINTH.width, PLINTH.height, PLINTH.depth), [])
  // repeat: [1, 1] — a single stone-block face rather than a tiled
  // multi-block pattern, so the plinth reads as one solid monolith with a
  // naturally weathered edge (the mortar-groove effect from
  // stoneWallMaterial.js lands at the block's own boundary) instead of
  // brickwork, which would fight "minimalist... minimal detailing."
  const plinthMaterial = useMemo(() => createStoneWallMaterial('#6e685e', [1, 1]), [])

  const screenCenterY = MONITOR_ANCHOR.screenCenterHeight

  // Casing material: matte, mostly non-metallic — a painted/textured
  // industrial finish rather than the previous sleek brushed-aluminum look.
  const casingProps = { color: '#2b2a28', roughness: 0.75, metalness: 0.12 }

  return (
    <group position={MONITOR_ANCHOR.position} rotation={[0, THREE.MathUtils.degToRad(MONITOR_YAW_DEGREES), 0]}>
      {/*
        Stone plinth — a single solid monolith, not a desk or a museum
        pedestal. `receiveShadow` (so contact shadows from the housing and
        the breach's raking light land on it) and `castShadow` (so it
        casts its own shadow onto the floor, grounding it physically).
      */}
      <mesh position={[0, PLINTH.height / 2, 0]} geometry={plinthGeometry} material={plinthMaterial} castShadow receiveShadow />

      {/* Rear hump — a smaller, recessed box suggesting the CRT tube's depth */}
      <mesh
        position={[0, housingCenterY, -HOUSING.frontDepth / 2 - HOUSING.rearDepth / 2 + 0.03]}
        geometry={rearHumpGeometry}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...casingProps} />
      </mesh>

      {/* Main housing — deep, boxy, rounded-corner chassis */}
      <mesh position={[0, housingCenterY, 0]} geometry={housingGeometry} castShadow receiveShadow>
        <meshStandardMaterial {...casingProps} />
      </mesh>

      {/*
        Control knobs — small retro detail on the lower bezel. Shadow
        casting deliberately off: at this scale (0.028 radius) relative to
        the shadow map's texel density across the light's full frustum,
        thin geometry like this is exactly what's prone to shadow-map
        aliasing/shimmer, for negligible visual payoff — per
        technical-architecture.md §8's "disable shadows on objects where
        they provide negligible visual value."
      */}
      {[-0.14, 0].map((x, i) => (
        <mesh
          key={i}
          position={[x, screenCenterY - screenHeight / 2 - 0.08, screenFrontZ - 0.01]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow={false}
        >
          <cylinderGeometry args={[0.028, 0.028, 0.03, 16]} />
          <meshStandardMaterial color="#111112" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}

      {/*
        Screen surface — unlit procedural test pattern, provisional.
        `screenTestPatternMaterial` is a raw unlit ShaderMaterial (no PBR
        lighting model), so roughness/metalness don't apply to it — its
        "emission" is just its fragment-shader output read directly,
        `toneMapped: false`. Explicitly excluded from both cast and
        receive shadows so neither the bezel nor the entrance/side pillars
        can cast a shadow onto the glowing screen face.
      */}
      <mesh position={[0, screenCenterY, screenFrontZ]} castShadow={false} receiveShadow={false}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <primitive object={screenMaterial} attach="material" />
      </mesh>

      {/* Glass — a thin, subtly reflective pane over the screen */}
      <mesh position={[0, screenCenterY, glassFrontZ]} castShadow={false} receiveShadow={false}>
        <planeGeometry args={[screenWidth + 0.02, screenHeight + 0.02]} />
        <meshPhysicalMaterial
          color="#0a0a0c"
          roughness={0.08}
          metalness={0}
          transmission={0.85}
          thickness={0.02}
          transparent
          opacity={0.25}
        />
      </mesh>
    </group>
  )
}
