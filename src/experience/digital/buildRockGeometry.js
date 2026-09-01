import * as THREE from 'three'

/** Deterministic 3D hash, matching the approach already used in stoneWallMaterial.js. */
function hash3(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return s - Math.floor(s)
}

/**
 * A raw, naturally-broken stone block: a subdivided `BoxGeometry` with each
 * vertex displaced outward by layered noise, EXCEPT vertices at or near the
 * exact top face — those are left undisplaced, so whatever stands on it
 * always has a genuinely flat plane to sit on no matter how the noise seed
 * shakes out. Shared by `Monitor.jsx` and `CinemaCamera.jsx`, now that each
 * builds its own separate plinth rather than the two sharing one.
 */
export function buildRockGeometry(width, height, depth) {
  const segments = 6
  const geometry = new THREE.BoxGeometry(width, height, depth, segments, segments, segments)
  const pos = geometry.attributes.position
  const halfH = height / 2
  const maxJag = Math.min(width, depth) * 0.2

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
