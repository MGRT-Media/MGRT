import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { lightingParams } from '../lighting/volumetricLighting.js'
import { createScreenTestPatternMaterial } from './screenTestPatternMaterial.js'

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
 * reference-monitor console, standing on a stout equipment cart within the
 * Phase 1B beam's floor target. Not the final Digital composition (that's
 * Phase 2, per build-workflow.md §10).
 *
 * `screenCenterHeight` is computed from the console's actual stacked
 * dimensions below (cart height + housing offset), not hand-picked — it
 * lands close to the previous flat-panel design's value by construction of
 * realistic proportions, and `cameraPath.js` re-derives its monitor-aligned
 * shot from whatever this value actually is, so the two stay in sync
 * automatically if the console's proportions change again later.
 */
const CART = {
  legHeight: 0.75,
  legRadius: 0.035,
  platformWidth: 1.3,
  platformDepth: 0.9,
  platformHeight: 0.06,
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

const platformTopY = CART.legHeight + CART.platformHeight
const housingCenterY = platformTopY + HOUSING.height / 2
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
  const platformGeometry = useMemo(
    () => new RoundedBoxGeometry(CART.platformWidth, CART.platformHeight, CART.platformDepth, 2, 0.02),
    [],
  )

  const screenCenterY = MONITOR_ANCHOR.screenCenterHeight

  // Casing material: matte, mostly non-metallic — a painted/textured
  // industrial finish rather than the previous sleek brushed-aluminum look.
  const casingProps = { color: '#2b2a28', roughness: 0.75, metalness: 0.12 }

  return (
    <group position={MONITOR_ANCHOR.position} rotation={[0, THREE.MathUtils.degToRad(MONITOR_YAW_DEGREES), 0]}>
      {/* Equipment cart — four short legs and a platform, retro AV-cart styling */}
      {[
        [-CART.platformWidth / 2 + 0.08, -CART.platformDepth / 2 + 0.08],
        [CART.platformWidth / 2 - 0.08, -CART.platformDepth / 2 + 0.08],
        [-CART.platformWidth / 2 + 0.08, CART.platformDepth / 2 - 0.08],
        [CART.platformWidth / 2 - 0.08, CART.platformDepth / 2 - 0.08],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, CART.legHeight / 2, z]} castShadow receiveShadow>
          <cylinderGeometry args={[CART.legRadius, CART.legRadius, CART.legHeight, 12]} />
          <meshStandardMaterial color="#19191a" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      <mesh
        position={[0, CART.legHeight + CART.platformHeight / 2, 0]}
        geometry={platformGeometry}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#1d1d1e" roughness={0.55} metalness={0.4} />
      </mesh>

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
