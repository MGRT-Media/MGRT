import { useMemo } from 'react'
import * as THREE from 'three'
import { lightingParams } from '../lighting/volumetricLighting.js'
import { sampleCameraPath } from '../timeline/cameraPath.js'
import { groundY as GROUND_Y } from './highway.js'
import { useExteriorLayer } from './layers.js'

/**
 * The sky the highway sits under: a graded dome, stars, and a moon.
 *
 * The dome is doing more work than it looks. Before it, the fogged ground
 * resolved to the fog colour at the horizon and met the canvas's own near
 * black directly above it — a hard seam right across the shot. Grading the
 * dome from that same fog colour at the horizon up to a deep blue at the
 * zenith closes the seam and gives the stars somewhere to sit, for one
 * unlit draw call. The gradient is tight — fully at the zenith colour by
 * ~13 degrees of elevation — because the frame only ever sees the bottom
 * ~23 degrees of sky, and a gentler ramp spent all of it in the pale
 * transition and read as washed-out grey rather than as night.
 *
 * Everything here has `fog: false`. The scene's exponential fog fully
 * saturates by ~120 units, so anything at sky distance would otherwise be
 * erased — the sky has to sit outside the haze the way a real one does,
 * with the haze in front of it.
 *
 * All of it is placed relative to the camera's own resting pose at the end
 * of the pull-back rather than to world origin, so the composition is
 * framed where it is actually seen. The camera only travels ~21 units after
 * the swap, which against a 300-unit sky is a parallax of a few degrees —
 * enough to feel like distance, far too little to drift out of frame.
 */

const SKY_RADIUS = 360
const STAR_RADIUS = 320
const MOON_DISTANCE = 300

// Three ridges at increasing distance, each taller and paler than the one
// in front. A single silhouette reads as a cut-out; the stack is what
// actually produces depth, and it is the paling — aerial perspective — doing
// the work rather than the geometry. The nearest band is a full silhouette,
// the furthest is barely separated from the horizon haze.
// Darker than the haze they rise out of, not lighter — the first pass had
// this inverted and the hills read as banks of fog rather than as land.
// Aerial perspective then runs the right way round: the nearer band is the
// darker silhouette, the further one sits closer to the horizon colour.
const RIDGES = [
  { radius: 215, minHeight: 8, maxHeight: 19, tint: 1.0, seed: 1.7 },
  { radius: 258, minHeight: 16, maxHeight: 31, tint: 0.66, seed: 4.1 },
  { radius: 300, minHeight: 26, maxHeight: 46, tint: 0.34, seed: 6.9 },
]
const RIDGE_SEGMENTS = 96
const RIDGE_TOP_COLOR = new THREE.Color('#171b23')

const HORIZON_COLOR = new THREE.Color(lightingParams.fog.color)
const ZENITH_COLOR = new THREE.Color('#080a12')

// Where the moon sits, as a fraction of the frame from centre at the reveal
// — right of the billboard and above it, filling the one quiet corner of
// the composition. Expressed in frame terms rather than world coordinates
// because that is the thing actually being chosen; the world position falls
// out of it. The vertical figure is aspect-independent (Three's fov is
// vertical), the horizontal one is quoted for 16:9.
const MOON_FRAME_RIGHT = 0.3
const MOON_FRAME_UP = 0.58

const revealPose = (() => {
  const sample = sampleCameraPath(1)
  const position = new THREE.Vector3().fromArray(sample.position)
  const forward = new THREE.Vector3().fromArray(sample.lookAt).sub(position).normalize()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, forward).normalize()
  return { position, forward, right, up }
})()

const HALF_V = Math.tan(THREE.MathUtils.degToRad(45 / 2))
export const MOON_POSITION = revealPose.forward
  .clone()
  .addScaledVector(revealPose.right, MOON_FRAME_RIGHT * HALF_V * (16 / 9))
  .addScaledVector(revealPose.up, MOON_FRAME_UP * HALF_V)
  .normalize()
  .multiplyScalar(MOON_DISTANCE)
  .add(revealPose.position)

/** Soft-limbed disc, reused for the moon and (stretched, dimmed) its halo. */
function discTexture(stops) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([at, alpha]) => gradient.addColorStop(at, `rgba(255,255,255,${alpha})`))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STAR_COUNT = 420

function buildStars() {
  const random = mulberry32(0x53544152)
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const color = new THREE.Color()

  for (let i = 0; i < STAR_COUNT; i += 1) {
    // Nothing below 6°: the ground plane's own silhouette sits ~2° under
    // the horizontal from here, and a star under that line would read as
    // hanging below the horizon.
    const elevation = THREE.MathUtils.degToRad(6 + random() * 78)
    const azimuth = random() * Math.PI * 2
    const horizontal = Math.cos(elevation) * STAR_RADIUS
    positions[i * 3] = revealPose.position.x + Math.cos(azimuth) * horizontal
    positions[i * 3 + 1] = revealPose.position.y + Math.sin(elevation) * STAR_RADIUS
    positions[i * 3 + 2] = revealPose.position.z + Math.sin(azimuth) * horizontal

    // Brightness carries the variation, since `PointsMaterial` has one size
    // for the object — and it doubles as the horizon fade, which is what
    // stops the field ending in a hard line where the haze begins.
    const magnitude = Math.pow(random(), 2.2)
    const horizonFade = THREE.MathUtils.smoothstep(THREE.MathUtils.radToDeg(elevation), 6, 26)
    color.setHSL(0.55 + (random() - 0.5) * 0.12, 0.18, 0.5)
    const brightness = (0.35 + magnitude * 1.15) * (0.3 + horizonFade * 0.7)
    colors[i * 3] = color.r * brightness
    colors[i * 3 + 1] = color.g * brightness
    colors[i * 3 + 2] = color.b * brightness
  }
  return { positions, colors }
}

/**
 * One ridge band: a skirt of triangles around the horizon whose upper edge
 * is a layered sine profile. Deterministic, ~200 triangles, one draw call.
 *
 * The base drops well below the horizon and is coloured exactly the fog
 * colour, so wherever the ground plane's own far edge happens to fall the
 * two meet invisibly and the ridge appears to rise out of the haze. That is
 * also why these can sit outside the fog (`fog: false`, like everything
 * else at sky distance, which would otherwise be erased outright): the
 * fade into haze is painted into the vertex colours instead, which is the
 * same thing aerial perspective does in reality.
 */
function buildRidge({ radius, minHeight, maxHeight, tint, seed }) {
  const positions = []
  const colors = []
  const indices = []
  const base = new THREE.Color(HORIZON_COLOR)
  const top = new THREE.Color(HORIZON_COLOR).lerp(RIDGE_TOP_COLOR, tint)

  for (let i = 0; i <= RIDGE_SEGMENTS; i += 1) {
    const angle = (i / RIDGE_SEGMENTS) * Math.PI * 2
    const profile =
      0.5 +
      0.3 * Math.sin(angle * 3 + seed) +
      0.16 * Math.sin(angle * 7 + seed * 2.3) +
      0.08 * Math.sin(angle * 13 + seed * 0.7)
    const height = THREE.MathUtils.lerp(minHeight, maxHeight, THREE.MathUtils.clamp(profile, 0, 1))
    const x = revealPose.position.x + Math.cos(angle) * radius
    const z = revealPose.position.z + Math.sin(angle) * radius

    positions.push(x, GROUND_Y - 30, z, x, GROUND_Y + height, z)
    colors.push(base.r, base.g, base.b, top.r, top.g, top.b)

    if (i < RIDGE_SEGMENTS) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  return geometry
}

function buildDome() {
  const geometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 20)
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()
  for (let i = 0; i < position.count; i += 1) {
    const height = THREE.MathUtils.clamp(position.getY(i) / SKY_RADIUS, 0, 1)
    color.copy(HORIZON_COLOR).lerp(ZENITH_COLOR, THREE.MathUtils.smoothstep(height, 0, 0.22))
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

export default function NightSky() {
  const applyExteriorLayer = useExteriorLayer()
  const domeGeometry = useMemo(buildDome, [])
  const ridgeGeometries = useMemo(() => RIDGES.map(buildRidge), [])
  const stars = useMemo(buildStars, [])
  const starTexture = useMemo(() => discTexture([[0, 1], [0.35, 0.5], [1, 0]]), [])
  const moonTexture = useMemo(() => discTexture([[0, 1], [0.82, 0.97], [0.94, 0.35], [1, 0]]), [])
  const haloTexture = useMemo(() => discTexture([[0, 0.5], [0.3, 0.16], [1, 0]]), [])

  return (
    <group ref={applyExteriorLayer}>
      {/* Drawn first and writing no depth, so it can never occlude the
          stars, the moon, or anything on the ground in front of it. */}
      <mesh
        geometry={domeGeometry}
        position={revealPose.position}
        renderOrder={-1}
        frustumCulled={false}
      >
        <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>

      {/* Ridges sit between the stars and the ground, and DO write depth —
          so a star low on the horizon is correctly hidden behind a hill
          rather than shining through it. */}
      {ridgeGeometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} frustumCulled={false}>
          <meshBasicMaterial vertexColors side={THREE.DoubleSide} fog={false} />
        </mesh>
      ))}

      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[stars.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={starTexture}
          size={2.2}
          vertexColors
          transparent
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* Sprites rather than oriented quads: they face the camera by
          construction, so nothing has to be kept aligned as the camera
          moves. Scaled to about three times the moon's true angular size —
          honest scale reads as a speck, and every night photograph the eye
          trusts is exaggerated the same way. */}
      <sprite position={MOON_POSITION} scale={[34, 34, 1]}>
        <spriteMaterial
          map={haloTexture}
          color="#7f8db0"
          transparent
          opacity={0.5}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite position={MOON_POSITION} scale={[8, 8, 1]}>
        <spriteMaterial
          map={moonTexture}
          color="#efeade"
          transparent
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}
