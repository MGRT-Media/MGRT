import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMPAIGNS_SWAP_DISTANCE, campaignsRailDistance } from '../timeline/cameraPath.js'
import { MODEL_URLS, cloneNode, measure, useModel } from '../models/modelAssets.js'
import { CENTRELINE_CURVE, LANES, groundY } from './highway.js'
import { useExteriorLayer } from './layers.js'

/**
 * Night traffic on the highway.
 *
 * At the distances this shot works at — the nearest lane is ~13 to the
 * camera's side and the road runs from ~26 out to the fog limit — what
 * actually reads is the lights, not the vehicles. So the bodies are cheap
 * dark volumes whose only job is silhouette and occlusion, and the lights
 * carry the performance. That is also why there are no headlight cones or
 * road pools: at this range they would be invisible or, worse, bloom.
 *
 * Everything is drawn in four calls regardless of how many vehicles there
 * are — one `InstancedMesh` for the lower bodies, one for the upper
 * volumes, and one `Points` each for the headlamps and the tail lamps.
 * Adding vehicles costs a matrix and four points each, not a draw call.
 * (The lamps are two objects rather than one because `PointsMaterial`
 * carries a single size for the whole object, and a tail lamp that reads
 * the same size as a headlamp reads wrong. Two draw calls is a better trade
 * than a custom shader for four floats.)
 *
 * Motion is driven by real time rather than by scroll progress, which is a
 * deliberate exception to this project's "pure function of progress" rule
 * (technical-architecture.md §7). That rule exists so the cinematic
 * timeline is reversible and scrubbable; traffic is ambient life, not part
 * of the timeline, and cars reversing when the visitor scrolls back would
 * be absurd. The monitor's own video already sets this precedent. The
 * layout itself IS deterministic — a seeded generator, so the same road
 * comes back on every load.
 */

// The three vehicle models, and how the fleet is mixed from them. `node` is
// the mesh name inside `vehicles.glb`; `share` is how much of the traffic
// this type makes up, and `speed` its base speed in m/s.
//
// The silhouette numbers that used to live here — length, width, body and
// upper-box heights — are gone: they existed to shape a pair of scaled
// boxes, and the models carry their own real proportions (2.27 x 5.37m for
// the car, 12.11m for the truck, measured on load). Nothing is scaled;
// these were exported at true metre scale with their base on y = 0 and
// their length along +Z, precisely so they could drop into the placement
// this file already did.
const VEHICLE_TYPES = [
  { node: 'car', speed: 25, share: 0.5 },
  { node: 'van', speed: 22, share: 0.28 },
  { node: 'truck', speed: 19, share: 0.22 },
]

// Raised with the road's length (the carriageway now runs to -240 rather
// than -60), so the SPACING stays what it was rather than the same vehicles
// being stretched thinner over a longer road. The far half is fogged out of
// sight, which is why this is not simply doubled.
//
// Brought back down 38 -> 24 in the 2026-09-05 Musée-reference restraint
// pass (creative-reference.md §4A). Vehicles are distributed evenly along
// the curve (see `distance` below), so lowering the count directly widens
// the gaps rather than shortening the traffic: at the reveal the near
// carriageway read as a queue crowding the lower-left corner and competing
// with the billboard for attention. Fewer, better-spaced vehicles keep the
// road alive while restoring the negative space the composition needs —
// "purposeful 3D objects", not density for its own sake (§4's Do/Don't).
const VEHICLE_COUNT = 24
const LIGHTS_PER_VEHICLE = 4

const HEADLIGHT_COLOR = new THREE.Color('#ffeecb')
const TAILLIGHT_COLOR = new THREE.Color('#ff3418')
// World-space diameters, so a lamp shrinks with distance like everything
// else. Sized against the read at 40-90 units — the range the visible
// stretch of road occupies — not against a vehicle's real lamp, which at
// this distance would be a fraction of a pixel.
const HEADLIGHT_SIZE = 1.5
const TAILLIGHT_SIZE = 1.0

// Deterministic layout: the same road every load, without hand-placing 22
// vehicles. Seeded rather than `Math.random` so a reported framing is
// reproducible.
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A soft round falloff, so a lamp reads as a glow rather than a square. */
function lampTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  // A tight solid core with a soft halo around it, rather than a gentle
  // falloff from the centre. The first version faded from the very middle,
  // which at these distances left a lamp with no readable core at all — the
  // lights were being drawn correctly and simply could not be seen.
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.2, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.36, 'rgba(255,255,255,0.42)')
  gradient.addColorStop(0.66, 'rgba(255,255,255,0.1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildFleet() {
  const random = mulberry32(0x4d475254)
  const curveLength = CENTRELINE_CURVE.getLength()
  const vehicles = []

  for (let i = 0; i < VEHICLE_COUNT; i += 1) {
    // Pick a type by share rather than uniformly, so cars dominate and
    // trucks stay occasional — a uniform mix reads as a toy set.
    const roll = random()
    let cumulative = 0
    let type = VEHICLE_TYPES[0]
    for (const candidate of VEHICLE_TYPES) {
      cumulative += candidate.share
      if (roll <= cumulative) {
        type = candidate
        break
      }
    }

    const lane = LANES[Math.floor(random() * LANES.length)]
    vehicles.push({
      type,
      typeIndex: VEHICLE_TYPES.indexOf(type),
      lane,
      // Spacing comes from an even split plus a large random jitter, not
      // from pure randomness: pure randomness clumps, and an even split
      // alone gives the convoy look the brief rules out.
      distance: ((i + 0.5) / VEHICLE_COUNT + (random() - 0.5) * 0.8 / VEHICLE_COUNT) * curveLength,
      // Speed varies per vehicle AND slower lanes sit outboard, so the
      // relative motion between lanes keeps changing instead of the whole
      // road sliding as one block.
      speed: type.speed * (0.86 + random() * 0.28) * (Math.abs(lane.offset) > 4 ? 0.94 : 1.04),
      lateral: (random() - 0.5) * 0.5,
    })
  }

  // Each type gets its own InstancedMesh, so every vehicle needs to know
  // which slot it occupies within its own type's instance buffer.
  const perType = VEHICLE_TYPES.map(() => 0)
  vehicles.forEach((vehicle) => {
    vehicle.slot = perType[vehicle.typeIndex]
    perType[vehicle.typeIndex] += 1
  })

  return { vehicles, curveLength, counts: perType }
}

/**
 * Pulls the three vehicle meshes out of `vehicles.glb` once, and measures
 * each one.
 *
 * The file is loaded a single time and its geometry handed to three
 * `InstancedMesh`es — so twenty-four vehicles cost twenty-four matrices and
 * three draw calls, not twenty-four scene-graph clones. The measurements
 * replace the hand-written silhouette constants this file used to carry:
 * lamp placement now comes from where each model's bodywork actually ends.
 */
function useVehicleModels() {
  const gltf = useModel(MODEL_URLS.vehicles)

  return useMemo(
    () =>
      VEHICLE_TYPES.map((type) => {
        const node = cloneNode(gltf, type.node)
        if (!node) return null
        const { size, box } = measure(node)
        return {
          geometry: node.geometry,
          size,
          box,
          // Lamps sit at the outer ends of the real bodywork rather than at
          // a guessed offset from a box's centre.
          halfLength: size.z / 2,
          lampY: box.min.y + size.y * 0.34,
          lampInset: Math.max(size.x / 2 - 0.25, 0.2),
        }
      }),
    [gltf],
  )
}

export default function Traffic() {
  const applyExteriorLayer = useExteriorLayer()
  const fleetRefs = useRef([])
  const headlightsRef = useRef(null)
  const taillightsRef = useRef(null)

  const { vehicles, curveLength, counts } = useMemo(buildFleet, [])
  const models = useVehicleModels()
  const texture = useMemo(lampTexture, [])

  // Colours never change, so they are written once at build time; only
  // positions are touched per frame. The small per-vehicle jitter keeps the
  // fleet from reading as one uniform bulb type — real traffic is a mix of
  // warm halogen and cold LED.
  const lamps = useMemo(() => {
    const count = VEHICLE_COUNT * 2
    const random = mulberry32(0x48454144)
    const make = (base, spread) => {
      const colors = new Float32Array(count * 3)
      const color = new THREE.Color()
      for (let i = 0; i < count; i += 2) {
        color.copy(base).offsetHSL((random() - 0.5) * spread, 0, (random() - 0.5) * 0.12)
        // Both lamps on a vehicle match each other, as they would.
        for (let side = 0; side < 2; side += 1) {
          colors[(i + side) * 3] = color.r
          colors[(i + side) * 3 + 1] = color.g
          colors[(i + side) * 3 + 2] = color.b
        }
      }
      return { positions: new Float32Array(count * 3), colors }
    }
    return { head: make(HEADLIGHT_COLOR, 0.06), tail: make(TAILLIGHT_COLOR, 0.02) }
  }, [])

  const scratch = useMemo(
    () => ({
      point: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      side: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      quaternion: new THREE.Quaternion(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      matrix: new THREE.Matrix4(),
    }),
    [],
  )

  useFrame(({ camera }, delta) => {
    // The exterior is not rendered until the swap, so nothing here needs to
    // run before it — no vehicle maths at all during Intro, Film or
    // Digital. Keyed off the camera's own position for the same reason the
    // swap itself is (see `campaignsRailDistance`).
    if (campaignsRailDistance(camera.position) < CAMPAIGNS_SWAP_DISTANCE - 2) return

    const fleet = fleetRefs.current
    const headlights = headlightsRef.current
    const taillights = taillightsRef.current
    if (!headlights || !taillights || fleet.length !== VEHICLE_TYPES.length) return
    if (fleet.some((mesh) => !mesh)) return

    // Clamped so a backgrounded tab does not teleport the whole road on the
    // frame it comes back.
    const step = Math.min(delta, 0.1)
    const { point, tangent, side, up, quaternion, position, scale, matrix } = scratch
    const headPositions = headlights.geometry.attributes.position.array
    const tailPositions = taillights.geometry.attributes.position.array

    vehicles.forEach((vehicle, i) => {
      const { type, lane } = vehicle
      vehicle.distance = (vehicle.distance + vehicle.speed * step * lane.direction + curveLength) % curveLength

      const u = vehicle.distance / curveLength
      CENTRELINE_CURVE.getPointAt(u, point)
      CENTRELINE_CURVE.getTangentAt(u, tangent)
      side.crossVectors(tangent, up).normalize()

      const offset = lane.offset + vehicle.lateral
      const x = point.x + side.x * offset
      const z = point.z + side.z * offset
      // Facing follows the lane's own direction of travel, so oncoming
      // vehicles are genuinely turned around rather than driving backwards.
      const yaw = Math.atan2(tangent.x * lane.direction, tangent.z * lane.direction)
      quaternion.setFromAxisAngle(up, yaw)

      const sin = Math.sin(yaw)
      const cos = Math.cos(yaw)
      const model = models[vehicle.typeIndex]
      if (!model) return
      const half = model.halfLength

      // No scaling: the models were exported at true metre scale with their
      // wheels on y = 0, so they are simply placed. `groundY + 0.03` is the
      // same road surface offset the boxes used, which is what keeps them
      // sitting on the carriageway rather than in it.
      position.set(x, groundY + 0.03, z)
      scale.set(1, 1, 1)
      fleet[vehicle.typeIndex].setMatrixAt(vehicle.slot, matrix.compose(position, quaternion, scale))

      // Lamps sit just proud of the body so the body itself occludes the
      // pair on its far end — which is what makes an approaching vehicle
      // show only headlights and a receding one only taillights, without a
      // single line of visibility logic.
      const lampY = groundY + 0.03 + model.lampY
      const inset = model.lampInset
      for (let lamp = 0; lamp < LIGHTS_PER_VEHICLE; lamp += 1) {
        const isHead = lamp < 2
        const forward = isHead ? half + 0.06 : -half - 0.06
        const lateral = lamp % 2 === 0 ? -inset : inset
        const target = isHead ? headPositions : tailPositions
        const index = (i * 2 + (lamp % 2)) * 3
        target[index] = x + sin * forward + cos * lateral
        target[index + 1] = lampY
        target[index + 2] = z + cos * forward - sin * lateral
      }
    })

    fleet.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true
    })
    headlights.geometry.attributes.position.needsUpdate = true
    taillights.geometry.attributes.position.needsUpdate = true
  })

  return (
    <group ref={applyExteriorLayer}>
      {/* One InstancedMesh per vehicle model. Adding vehicles costs a
          matrix each, not a draw call — the same trade the scaled boxes
          made, now carrying real bodywork. Deliberately near-black still:
          at night on an unlit highway a vehicle IS a silhouette between
          its own lamps, and a fully lit model would read as a showroom
          car parked on a dark road. */}
      {VEHICLE_TYPES.map((type, index) => {
        const model = models[index]
        if (!model || !counts[index]) return null
        return (
          <instancedMesh
            key={type.node}
            ref={(mesh) => {
              fleetRefs.current[index] = mesh
            }}
            args={[model.geometry, undefined, counts[index]]}
            frustumCulled={false}
            castShadow
          >
            <meshStandardMaterial color="#0a0a0e" roughness={0.55} metalness={0.35} />
          </instancedMesh>
        )
      })}

      {/* Lamps. Additive over the dark road so they read as emitting
          rather than as painted dots. `fog: false` is the one place in this
          scene that opts out of the haze, and it has to: at the 40-90 units
          the visible traffic occupies, the fog is already ~94% saturated,
          which mixed the lamps down to the fog colour and erased them
          completely — the first pass rendered vehicles with no lights at
          all. Physically it is also the right answer, since a point source
          is exactly what stays visible through haze after everything around
          it has dissolved. They sit just proud of the body, so the
          body occludes whichever pair faces away — an approaching vehicle
          shows only headlamps and a receding one only tail lamps, with no
          visibility logic anywhere. */}
      <points ref={headlightsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lamps.head.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[lamps.head.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={texture}
          size={HEADLIGHT_SIZE}
          vertexColors
          transparent
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      <points ref={taillightsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lamps.tail.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[lamps.tail.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={texture}
          size={TAILLIGHT_SIZE}
          vertexColors
          transparent
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  )
}
