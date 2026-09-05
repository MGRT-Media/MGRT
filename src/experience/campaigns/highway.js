import * as THREE from 'three'
import { CAMPAIGNS_RAIL } from '../timeline/cameraPath.js'
import { BILLBOARD_PLACEMENT } from './Billboard.jsx'

/**
 * The highway's own geometry — its centreline, its lanes, and the ribbon
 * builder every painted surface is made from.
 *
 * Extracted out of `ExteriorEnvironment.jsx` when traffic arrived: the
 * vehicles have to follow exactly the same centreline the road is drawn
 * from, and having them import it from the component that renders the road
 * would have made a cycle (that component now renders the traffic). This
 * module holds no JSX and imports nothing from either, so both can depend on
 * it. Nothing about the layout changed in the move.
 */

export const { groundY } = BILLBOARD_PLACEMENT

export const LANE_WIDTH = 3.5
const LANE_COUNT = 4
export const CARRIAGEWAY_HALF_WIDTH = (LANE_WIDTH * LANE_COUNT) / 2 // 7 — two lanes each direction
export const SHOULDER_WIDTH = 1.6

// The centreline is generated from the camera's own rail rather than
// written out as coordinates. Running the road parallel to `CAMPAIGNS_RAIL`
// means it converges on exactly the vanishing point the camera is receding
// along, which is what makes the final shot read as one coherent space
// instead of a road parked next to a sign — and it means moving the camera
// path never silently strands the highway.
//
// `s` is distance along the rail direction from the anchor; `lateral` bends
// the line steadily toward the traffic's right as `s` grows, giving the
// gentle right-hand curve. The odd-power term keeps the curvature close to
// zero beside the billboard and increases with distance, so the bend reads
// as the road sweeping away rather than as a kink.
export const RAIL_DIRECTION = new THREE.Vector3().fromArray(CAMPAIGNS_RAIL.direction).setY(0).normalize()
// The traffic's right-hand side: the billboard is offset along +this, which
// is what literally places it on the road's right-hand shoulder.
export const ROAD_RIGHT = new THREE.Vector3(RAIL_DIRECTION.z, 0, -RAIL_DIRECTION.x)

// Far enough off the carriageway to clear both half-widths with a real
// verge between them, and no further — the billboard should read as
// belonging to this road, not as standing in a neighbouring field.
const BILLBOARD_SHOULDER_OFFSET =
  BILLBOARD_PLACEMENT.width / 2 + CARRIAGEWAY_HALF_WIDTH + SHOULDER_WIDTH + 2.4

const ROAD_ANCHOR = new THREE.Vector3()
  .fromArray(BILLBOARD_PLACEMENT.center)
  .setY(groundY)
  .addScaledVector(ROAD_RIGHT, -BILLBOARD_SHOULDER_OFFSET)

const CURVE_STRENGTH = 0.0012

/**
 * The centreline as a formula rather than only as a curve, so things that
 * need to sit on the road's median can be placed at any `s` — including
 * past the ends of the drawn ribbon, where `StreetLights.jsx` continues the
 * run of lamps into the haze. The drawn curve interpolates samples of this
 * same function, so the two cannot drift apart.
 */
export function roadFramePoint(s, lateral, target = new THREE.Vector3()) {
  return centrelinePoint(s, target).addScaledVector(ROAD_RIGHT, lateral)
}

/**
 * Where a world position sits in the road's own frame: `s` along it,
 * `lateral` across it. Used by the landscape to flatten a corridor for the
 * carriageway rather than letting dunes swallow it.
 */
export function roadFrame(x, z, scratch = new THREE.Vector3()) {
  const s = (x - ROAD_ANCHOR.x) * RAIL_DIRECTION.x + (z - ROAD_ANCHOR.z) * RAIL_DIRECTION.z
  centrelinePoint(s, scratch)
  return { s, lateral: (x - scratch.x) * ROAD_RIGHT.x + (z - scratch.z) * ROAD_RIGHT.z }
}

export function centrelinePoint(s, target = new THREE.Vector3()) {
  return target
    .copy(ROAD_ANCHOR)
    .addScaledVector(RAIL_DIRECTION, s)
    .addScaledVector(ROAD_RIGHT, CURVE_STRENGTH * s * Math.abs(s))
}

// Extended well past the old -60 so the carriageway runs on toward the
// mountains instead of stopping inside the haze. The far end is beyond
// anything the fog leaves visible, which is the point: the road should end
// because the air ends, not because the geometry does.
export const ROAD_S_NEAR = 100
export const ROAD_S_FAR = -240
const CENTRELINE_POINTS = Array.from({ length: 18 }, (_, i) =>
  centrelinePoint(ROAD_S_NEAR - i * ((ROAD_S_NEAR - ROAD_S_FAR) / 17)),
).reverse()

export const CENTRELINE_CURVE = new THREE.CatmullRomCurve3(CENTRELINE_POINTS, false, 'centripetal')

/**
 * The four lanes, as a lateral `offset` in the same convention
 * `ribbonGeometry` uses plus the direction traffic runs in.
 *
 * The sign is worth stating because it is easy to get backwards: the ribbon
 * builder's `side` is `cross(tangent, up)`, which is the NEGATIVE of
 * `ROAD_RIGHT`. So a negative offset is the traffic's right-hand side —
 * where `direction: 1` vehicles belong, and the side the billboard stands
 * on. `direction: 1` runs along `RAIL_DIRECTION`, which is the way the
 * camera itself retreats: those vehicles come toward it out of the haze
 * showing headlights, while `direction: -1` vehicles pass it and recede
 * showing taillights.
 */
export const LANES = [
  { offset: -LANE_WIDTH * 1.5, direction: 1 },
  { offset: -LANE_WIDTH * 0.5, direction: 1 },
  { offset: LANE_WIDTH * 0.5, direction: -1 },
  { offset: LANE_WIDTH * 1.5, direction: -1 },
]

/**
 * A flat ribbon following the centreline at a lateral `offset`, `halfWidth`
 * wide — the one primitive the carriageway, its shoulders and every lane
 * marking are all built from, rather than three near-identical mesh
 * builders. `dashLength`/`gapLength` (in ribbon segments) make the broken
 * lane lines; omitting them gives a continuous ribbon.
 *
 * Ribbons are stacked with a small `lift` each so they never z-fight: the
 * road sits above the ground, the markings above the road.
 */
export function ribbonGeometry({ offset = 0, halfWidth, lift, segments = 160, dashLength = 0, gapLength = 0 }) {
  const positions = []
  const indices = []
  const up = new THREE.Vector3(0, 1, 0)
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const side = new THREE.Vector3()

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    CENTRELINE_CURVE.getPoint(t, point)
    CENTRELINE_CURVE.getTangent(t, tangent)
    side.crossVectors(tangent, up).normalize()
    const cx = point.x + side.x * offset
    const cz = point.z + side.z * offset
    positions.push(
      cx - side.x * halfWidth, groundY + lift, cz - side.z * halfWidth,
      cx + side.x * halfWidth, groundY + lift, cz + side.z * halfWidth,
    )
  }

  const period = dashLength + gapLength
  for (let i = 0; i < segments; i += 1) {
    if (period > 0 && i % period >= dashLength) continue
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
