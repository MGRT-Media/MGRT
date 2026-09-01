import { useMemo } from 'react'
import * as THREE from 'three'
import { createStoneWallMaterial } from '../materials/stoneWallMaterial.js'
import { PLINTH, PLINTH_CENTER, PLINTH_YAW_DEGREES } from './plinthAnchor.js'

/** Deterministic 3D hash, matching stoneWallMaterial.js's convention. */
function hash3(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return s - Math.floor(s)
}

/**
 * The raw, naturally-broken stone plinth shared by the Cinema Camera and
 * the Monitor (Phase 2) — moved out of `Monitor.jsx`, which owned it alone
 * during Phase 1D, now that it's a shared composition element rather than
 * a single object's support. Same displaced-`BoxGeometry` technique as
 * before, just built at the shared, widened `PLINTH` footprint.
 */
function buildRockGeometry(width, height, depth) {
  const segments = 6
  const geometry = new THREE.BoxGeometry(width, height, depth, segments, segments, segments)
  const pos = geometry.attributes.position
  const halfH = height / 2
  const maxJag = Math.min(width, depth) * 0.16

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)

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

export default function DigitalPlinth() {
  const geometry = useMemo(() => buildRockGeometry(PLINTH.width, PLINTH.height, PLINTH.depth), [])
  // repeat scaled to the plinth's own widened footprint, same single-block
  // (not tiled) read as Phase 1D's monolith.
  const material = useMemo(() => createStoneWallMaterial('#6e685e', [1.6, 1]), [])

  return (
    <group position={PLINTH_CENTER} rotation={[0, THREE.MathUtils.degToRad(PLINTH_YAW_DEGREES), 0]}>
      <mesh position={[0, PLINTH.height / 2, 0]} geometry={geometry} material={material} castShadow receiveShadow />
    </group>
  )
}
