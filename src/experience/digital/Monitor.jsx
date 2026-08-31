import { useMemo } from 'react'
import { lightingParams } from '../lighting/volumetricLighting.js'
import { createScreenTestPatternMaterial } from './screenTestPatternMaterial.js'

/**
 * Provisional Phase 1D monitor geometry — a simplified physical anchor
 * proving monitor placement, screen surface, and lighting continuity.
 * Not the final Digital composition (that's Phase 2, per
 * build-workflow.md §10).
 *
 * Positioned exactly at the Phase 1B light beam's floor target, so the
 * monitor stands within the volumetric beam's path rather than beside it.
 */
export const MONITOR_ANCHOR = {
  position: lightingParams.target,
  screenWidth: 1.5,
  screenHeight: 0.88,
  screenCenterHeight: 1.2,
}

const BASE_RADIUS = 0.3
const BASE_HEIGHT = 0.05
const NECK_HEIGHT = MONITOR_ANCHOR.screenCenterHeight - MONITOR_ANCHOR.screenHeight / 2 - BASE_HEIGHT
const BODY_DEPTH = 0.07
const BEZEL_MARGIN = 0.045

export default function Monitor() {
  const screenMaterial = useMemo(() => createScreenTestPatternMaterial(), [])

  const bodyCenterY = MONITOR_ANCHOR.screenCenterHeight
  const screenFrontZ = BODY_DEPTH / 2 + 0.001
  const glassFrontZ = screenFrontZ + 0.004

  return (
    <group position={MONITOR_ANCHOR.position}>
      {/* Base */}
      <mesh position={[0, BASE_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS * 1.1, BASE_HEIGHT, 24]} />
        <meshStandardMaterial color="#16161a" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, BASE_HEIGHT + NECK_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, NECK_HEIGHT, 16]} />
        <meshStandardMaterial color="#16161a" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Body / frame — dark brushed metal */}
      <mesh position={[0, bodyCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[MONITOR_ANCHOR.screenWidth, MONITOR_ANCHOR.screenHeight, BODY_DEPTH]} />
        <meshStandardMaterial color="#18181c" roughness={0.35} metalness={0.75} />
      </mesh>

      {/* Screen surface — unlit procedural test pattern, provisional */}
      <mesh position={[0, bodyCenterY, screenFrontZ]}>
        <planeGeometry
          args={[MONITOR_ANCHOR.screenWidth - BEZEL_MARGIN * 2, MONITOR_ANCHOR.screenHeight - BEZEL_MARGIN * 2]}
        />
        <primitive object={screenMaterial} attach="material" />
      </mesh>

      {/* Glass — a thin, subtly reflective pane over the screen */}
      <mesh position={[0, bodyCenterY, glassFrontZ]}>
        <planeGeometry args={[MONITOR_ANCHOR.screenWidth - BEZEL_MARGIN, MONITOR_ANCHOR.screenHeight - BEZEL_MARGIN]} />
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
