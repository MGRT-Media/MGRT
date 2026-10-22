import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { applyStoneMacroVariation } from '../materials/stoneMacroVariation.js'
import { LOOK } from './studioLook.js'
import { ROOM, TABLE } from './studioLayout.js'

/**
 * The studio's geometry builders. All of them write UVs in METRES, so a
 * material's texture repeat is one over its scan's size (`studioMaterials.js`)
 * and every surface carries its texture at real scale.
 */

// Segments per metre on the walls: enough for the baked tone drift to read as
// a gradient rather than as facets.
const WALL_DENSITY = 4

/** A flat surface of the given size, UVs in metres: the ceiling. */
export function buildSurfaceGeometry(width, height) {
  const geometry = new THREE.PlaneGeometry(width, height)
  const uv = geometry.attributes.uv
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * width, uv.getY(i) * height)
  return geometry
}

// Faces per metre on the floor: fine enough for the shade along the walls
// (`LOOK.floor.wallShade`) to be a gradient, not a step.
const FLOOR_DENSITY = 8

/**
 * The floor: `width` by `depth`, lying in its own XY plane before the scene
 * turns it flat, with its far edge (+Y) against the rear wall and its sides
 * against the side walls. The open front has no wall.
 *
 * The concrete darkens toward the walls, baked into its vertex colours: the
 * floor's half of the contact shading at the cove, where the walls close off
 * the light it would otherwise get from that side.
 */
export function buildFloorGeometry(width, depth) {
  const geometry = new THREE.PlaneGeometry(width, depth, Math.ceil(width * FLOOR_DENSITY), Math.ceil(depth * FLOOR_DENSITY))
  const { position, uv } = geometry.attributes
  const { reach, tone } = LOOK.floor.wallShade
  const colors = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i += 1) {
    uv.setXY(i, uv.getX(i) * width, uv.getY(i) * depth)
    const x = position.getX(i)
    const y = position.getY(i)
    const toWall = Math.min(width / 2 - Math.abs(x), depth / 2 - y)
    const level = THREE.MathUtils.lerp(tone, 1, THREE.MathUtils.smoothstep(toWall, 0, reach))
    colors.set([level, level, level], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

// Rows of faces round the cove's quarter turn: enough that it shades as a
// curve under a light raking down the wall.
const COVE_ROWS = 10

// Rows of faces up the band of wall above the cove that darkens toward the
// floor (`LOOK.plaster.base`). The tone is baked per vertex, and at the walls'
// own density that gradient would have one row to happen in.
const BASE_ROWS = 8

/**
 * A plaster wall, `width` wide and `height` tall, that turns into the floor
 * through a cove of `ROOM.coveRadius` instead of stopping at it.
 *
 * The wall and its cove are one sheet. It is laid out flat first — as tall as
 * the wall is long when measured down its face and round the curve — so its
 * UVs are in metres along the surface and the plaster keeps its scale all the
 * way round, with no stretch where it bends. Its tone is baked in at that
 * stage too — the slow drift of `LOOK.plaster.toneRange` and the darkening
 * toward the floor of `LOOK.plaster.base` — so both run unbroken from the wall
 * into the cove. Then the bottom of the sheet is rolled
 * forward into the quarter turn.
 *
 * Centred as a plane of that height would be, facing +Z, so it is placed
 * exactly as a flat wall is. `uvOffset` keeps two walls that meet from showing
 * the same patch of plaster either side of the corner; where two coves meet in
 * a corner they simply run through each other, which leaves a mitre.
 */
export function buildWallGeometry(width, height, { seed, uvOffset = [0, 0] }) {
  const radius = ROOM.coveRadius
  const straight = height - radius
  const turn = (Math.PI / 2) * radius
  // Three bands down the sheet: the wall, the darkening band above the cove,
  // and the cove itself, each with its own row spacing.
  const band = Math.max(LOOK.plaster.base.height - turn, 0)
  const upper = straight - band
  const wallRows = Math.ceil(upper * WALL_DENSITY)
  const rows = wallRows + BASE_ROWS + COVE_ROWS
  const geometry = new THREE.PlaneGeometry(width, 1, Math.ceil(width * WALL_DENSITY), rows)
  const { position, uv } = geometry.attributes

  // How far down the surface each row of vertices is, from the top of the wall.
  const downSurface = (row) => {
    if (row <= wallRows) return (row / wallRows) * upper
    if (row <= wallRows + BASE_ROWS) return upper + ((row - wallRows) / BASE_ROWS) * band
    return straight + ((row - wallRows - BASE_ROWS) / COVE_ROWS) * turn
  }
  const rowOf = (i) => Math.round((0.5 - position.getY(i)) * rows)

  for (let i = 0; i < position.count; i += 1) {
    const down = downSurface(rowOf(i))
    position.setY(i, height / 2 - down)
    uv.setXY(i, uv.getX(i) * width + uvOffset[0], straight + turn - down + uvOffset[1])
  }
  applyStoneMacroVariation(geometry, { seed, range: LOOK.plaster.toneRange })

  // Darken toward the floor — see `LOOK.plaster.base`.
  const { color } = geometry.attributes
  const { height: baseHeight, tone: baseTone } = LOOK.plaster.base
  for (let i = 0; i < position.count; i += 1) {
    const fromFloor = straight + turn - (height / 2 - position.getY(i))
    const level = THREE.MathUtils.lerp(baseTone, 1, THREE.MathUtils.smoothstep(fromFloor, 0, baseHeight))
    color.setXYZ(i, color.getX(i) * level, color.getY(i) * level, color.getZ(i) * level)
  }

  for (let i = 0; i < position.count; i += 1) {
    const round = height / 2 - position.getY(i) - straight
    if (round <= 0) continue
    // From vertical where it leaves the wall to level where it meets the floor.
    const angle = Math.PI / 2 - round / radius
    position.setY(i, radius - radius * Math.cos(angle) - height / 2)
    position.setZ(i, radius - radius * Math.sin(angle))
  }
  geometry.computeVertexNormals()
  return geometry
}

/** A small deterministic generator, so the table is the same table every load. */
function seeded(seed) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Rewrites a piece's UVs in metres with the grain (the texture's U) running
 * along `grain`, shifted by `shift` so no two pieces show the same stretch of
 * the scan, and bakes `tone` into its vertex colours, darker on faces cut
 * across the grain. Each face is projected along whichever axis it faces most,
 * so the small rounds on a piece's edges take the texture of the face they
 * turn from, without stretching.
 */
function grainPiece(geometry, { grain, shift, tone }) {
  const { position, normal, uv } = geometry.attributes
  const colors = new Float32Array(position.count * 3)
  const axes = ['x', 'y', 'z']
  const across = axes.filter((axis) => axis !== grain)
  const read = { x: (i) => position.getX(i), y: (i) => position.getY(i), z: (i) => position.getZ(i) }
  const facing = { x: (i) => normal.getX(i), y: (i) => normal.getY(i), z: (i) => normal.getZ(i) }

  for (let i = 0; i < position.count; i += 1) {
    const faces = axes.reduce((best, axis) => (Math.abs(facing[axis](i)) > Math.abs(facing[best](i)) ? axis : best))
    const endGrain = faces === grain
    // On a face along the grain, V runs across the one axis left in the face.
    // On an end, the two cross axes are all there is.
    const v = endGrain ? across[1] : across.find((axis) => axis !== faces)
    const u = endGrain ? across[0] : grain
    uv.setXY(i, read[u](i) + shift[0], read[v](i) + shift[1])
    const level = tone * (endGrain ? LOOK.walnut.endGrainTone : 1)
    colors.set([level, level, level], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

/** A straight piece of wood, its every edge eased by `TABLE.pieceRadius`. */
function woodPiece(size, center, options) {
  const geometry = new RoundedBoxGeometry(...size, 2, TABLE.pieceRadius)
  grainPiece(geometry, options)
  return geometry.translate(...center)
}

/** A rectangle with rounded corners, centred on the origin. */
function roundedRectangle(width, depth, radius) {
  const x = width / 2
  const y = depth / 2
  const shape = new THREE.Shape()
  shape.moveTo(-x + radius, -y)
  shape.lineTo(x - radius, -y)
  shape.quadraticCurveTo(x, -y, x, -y + radius)
  shape.lineTo(x, y - radius)
  shape.quadraticCurveTo(x, y, x - radius, y)
  shape.lineTo(-x + radius, y)
  shape.quadraticCurveTo(-x, y, -x, y - radius)
  shape.lineTo(-x, -y + radius)
  shape.quadraticCurveTo(-x, -y, -x + radius, -y)
  return shape
}

/**
 * The tabletop: one solid slab, its corners rounded in plan and its upper and
 * lower edges eased all the way round, so the light runs along them without a
 * break. The boards it is made of are drawn by the material
 * (`walnutBoards.js`), which keeps this surface continuous.
 *
 * The extrusion's own UVs are already in metres with U along the table's
 * length on the top and the long edges, which is the grain.
 */
function buildTabletop() {
  const { width, depth, height, topThickness, edgeRadius, cornerRadius } = TABLE
  const geometry = new THREE.ExtrudeGeometry(roundedRectangle(width, depth, cornerRadius), {
    depth: topThickness - 2 * edgeRadius,
    bevelEnabled: true,
    bevelThickness: edgeRadius,
    bevelSize: edgeRadius,
    // The round cuts inward, so the top keeps its exact footprint.
    bevelOffset: -edgeRadius,
    bevelSegments: 3,
    curveSegments: 6,
  })
  // The extrusion runs along +Z; lay it flat with its top surface at `height`.
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, height - topThickness + edgeRadius, 0)

  // UVs in metres that wrap over the edges: going over the front edge the
  // texture carries on from where the top left off, so a vein or a grain line
  // runs down the edge instead of restarting there. That is what makes the
  // top read as a solid block rather than a surface printed onto a box.
  const { position, normal, uv } = geometry.attributes
  const colors = new Float32Array(normal.count * 3)
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const down = height - y
    if (Math.abs(normal.getY(i)) > 0.7) uv.setXY(i, x, -z)
    else if (Math.abs(normal.getX(i)) >= Math.abs(normal.getZ(i))) uv.setXY(i, x + Math.sign(x) * down, -z)
    else uv.setXY(i, x, -z - Math.sign(z) * down)
    // On a wooden top the ends are end grain, and darker.
    const endGrain = LOOK.tableFinish === 'walnut' && Math.abs(normal.getX(i)) > 0.7
    const level = endGrain ? LOOK.walnut.endGrainTone : 1
    colors.set([level, level, level], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

/**
 * UVs in metres that wrap over a slab's edges: going over an edge, the stone
 * carries on from where the top left off, so a vein runs down the edge
 * instead of restarting there. `top` is the height of the slab's upper face.
 */
function wrappedSlabUv(x, y, z, normal, top) {
  const down = top - y
  if (Math.abs(normal.y) > 0.7) return [x, -z]
  if (Math.abs(normal.x) >= Math.abs(normal.z)) return [x + Math.sign(x) * down, -z]
  return [x, -z - Math.sign(z) * down]
}

// Faces round each plan corner of the stone slab, and round each of its two
// edge profiles: enough that neither silhouette nor highlight shows a facet.
const SLAB_CORNER_SEGMENTS = 12
const SLAB_TOP_ROUND_SEGMENTS = 6
const SLAB_UNDER_ROUND_SEGMENTS = 4

/**
 * The stone slab, built as a sweep: its edge profile — a round over the top
 * arris, a straight face, a smaller round under — carried round a rectangle
 * with rounded corners, with a flat face filling the top and the bottom.
 *
 * Every normal is the true one for its point on that profile, so the rounds
 * shade smoothly and the top stays perfectly flat right up to where its round
 * begins. Flat faces carry no more vertices than their outline needs.
 */
function buildStoneSlab() {
  const { width, depth, height } = TABLE
  const { thickness, edgeRadius, underEdgeRadius, cornerRadius } = TABLE.stone

  // The outline in plan, walked anticlockwise from above: each point with its
  // outward normal. Straight sides are the gaps between corner arcs.
  const outline = []
  const cx = width / 2 - cornerRadius
  const cz = depth / 2 - cornerRadius
  const corners = [
    [cx, cz],
    [-cx, cz],
    [-cx, -cz],
    [cx, -cz],
  ]
  corners.forEach(([x, z], corner) => {
    for (let i = 0; i <= SLAB_CORNER_SEGMENTS; i += 1) {
      const angle = (corner + i / SLAB_CORNER_SEGMENTS) * (Math.PI / 2)
      const nx = Math.cos(angle)
      const nz = Math.sin(angle)
      outline.push({ x: x + nx * cornerRadius, z: z + nz * cornerRadius, nx, nz })
    }
  })

  // The edge profile, top to bottom: how far in from the outline each point
  // is (`inset`), how far below the top surface (`drop`), and its normal as
  // (outward, up).
  const profile = []
  for (let i = 0; i <= SLAB_TOP_ROUND_SEGMENTS; i += 1) {
    const angle = (i / SLAB_TOP_ROUND_SEGMENTS) * (Math.PI / 2)
    profile.push({
      inset: edgeRadius - edgeRadius * Math.sin(angle),
      drop: edgeRadius - edgeRadius * Math.cos(angle),
      out: Math.sin(angle),
      up: Math.cos(angle),
    })
  }
  for (let i = 0; i <= SLAB_UNDER_ROUND_SEGMENTS; i += 1) {
    const angle = Math.PI / 2 + (i / SLAB_UNDER_ROUND_SEGMENTS) * (Math.PI / 2)
    profile.push({
      inset: underEdgeRadius - underEdgeRadius * Math.sin(angle),
      drop: thickness - underEdgeRadius - underEdgeRadius * Math.cos(angle),
      out: Math.sin(angle),
      up: Math.cos(angle),
    })
  }

  const positions = []
  const normals = []
  const uvs = []
  const indices = []
  const normal = new THREE.Vector3()
  const vertex = (x, y, z, nx, ny, nz) => {
    normal.set(nx, ny, nz).normalize()
    positions.push(x, y, z)
    normals.push(normal.x, normal.y, normal.z)
    uvs.push(...wrappedSlabUv(x, y, z, normal, height))
    return positions.length / 3 - 1
  }

  // The sweep: one ring of vertices per outline point, one per profile point.
  const rings = profile.length
  const first = positions.length / 3
  for (const point of outline) {
    for (const { inset, drop, out, up } of profile) {
      vertex(point.x - point.nx * inset, height - drop, point.z - point.nz * inset, point.nx * out, up, point.nz * out)
    }
  }
  for (let i = 0; i < outline.length; i += 1) {
    const next = (i + 1) % outline.length
    for (let j = 0; j < rings - 1; j += 1) {
      const a = first + i * rings + j
      const b = first + next * rings + j
      const c = first + next * rings + j + 1
      const d = first + i * rings + j + 1
      indices.push(a, b, d, b, c, d)
    }
  }

  // The flat faces, inside the rounds. Their outline is the sweep's first and
  // last rings, so they meet it exactly.
  const cap = (profilePoint, y, up) => {
    const contour = outline.map((point) => new THREE.Vector2(point.x - point.nx * profilePoint.inset, point.z - point.nz * profilePoint.inset))
    const start = positions.length / 3
    contour.forEach(({ x, y: z }) => vertex(x, y, z, 0, up, 0))
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      // Anticlockwise in plan faces down in three's Y-up frame; flip for the top.
      if (up > 0) indices.push(start + a, start + c, start + b)
      else indices.push(start + a, start + b, start + c)
    }
  }
  cap(profile[0], height, 1)
  cap(profile[profile.length - 1], height - thickness, -1)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

/**
 * A rounded block of stone, mapped in metres by projecting each face along
 * the axis it faces most, and shifted so no two blocks show the same stretch
 * of the scan.
 */
function stoneBlock(size, center, radius, shift) {
  const geometry = new RoundedBoxGeometry(...size, 4, radius)
  const { position, normal, uv } = geometry.attributes
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const ax = Math.abs(normal.getX(i))
    const ay = Math.abs(normal.getY(i))
    const az = Math.abs(normal.getZ(i))
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y]
    uv.setXY(i, u + shift[0], v + shift[1])
  }
  return geometry.translate(...center)
}

/**
 * The stone table: the slab, and two stone pedestals under it, each with a
 * recessed steel plate where it meets the slab. Returned as `top` (all the
 * stone, one geometry) and `frame` (the steel plates).
 */
function buildStoneTable() {
  const { width, height } = TABLE
  const { thickness, pedestal, reveal } = TABLE.stone
  const underside = height - thickness
  const pedestalHeight = underside - reveal.height
  const pedestalX = width / 2 - pedestal.centerFromEnd

  // The rounded blocks are non-indexed; the slab is converted to match, as
  // merging requires.
  const stone = [buildStoneSlab().toNonIndexed()]
  const steel = []
  ;[-pedestalX, pedestalX].forEach((x, index) => {
    stone.push(
      stoneBlock([pedestal.width, pedestalHeight, pedestal.depth], [x, pedestalHeight / 2, 0], pedestal.radius, [
        2.3 + index * 3.1,
        0.7 + index * 1.9,
      ]),
    )
    steel.push(
      new RoundedBoxGeometry(
        pedestal.width - 2 * reveal.inset,
        reveal.height,
        pedestal.depth - 2 * reveal.inset,
        2,
        reveal.radius,
      ).translate(x, underside - reveal.height / 2, 0),
    )
  })
  return { top: mergeGeometries(stone, false), frame: mergeGeometries(steel, false) }
}

/**
 * The table: the solid top, and its frame of four square legs with an apron
 * rail between each pair under the top. Returned as two geometries, `top` and
 * `frame`, because a stone top sits on a steel frame; a wooden table draws
 * both in the one material.
 *
 * As wood, grain runs along the top's length, up the legs, and along each
 * rail, every leg and rail its own piece with its own stretch of the scan.
 */
export function buildTableGeometry() {
  if (LOOK.tableFinish === 'stone') return buildStoneTable()
  const random = seeded(7)
  const { pieceTone } = LOOK.walnut
  const piece = (grain) => ({
    grain,
    shift: [random() * 7, random() * 7],
    tone: THREE.MathUtils.lerp(pieceTone[0], pieceTone[1], random()),
  })
  const { width, depth, height, topThickness, leg, apron } = TABLE
  const parts = []

  const underside = height - topThickness
  const legX = width / 2 - leg.endInset - leg.size / 2
  const legZ = depth / 2 - leg.sideInset - leg.size / 2
  for (const x of [-legX, legX]) {
    for (const z of [-legZ, legZ]) {
      parts.push(woodPiece([leg.size, underside, leg.size], [x, underside / 2, z], piece('y')))
    }
  }

  // Rails run between the legs' inner faces, their outer faces set back from
  // the legs' by `apron.setBack`.
  const railY = underside - apron.height / 2
  const railZ = legZ + leg.size / 2 - apron.setBack - apron.thickness / 2
  const railX = legX + leg.size / 2 - apron.setBack - apron.thickness / 2
  const longSpan = 2 * legX - leg.size
  const shortSpan = 2 * legZ - leg.size
  for (const z of [-railZ, railZ]) {
    parts.push(woodPiece([longSpan, apron.height, apron.thickness], [0, railY, z], piece('x')))
  }
  for (const x of [-railX, railX]) {
    parts.push(woodPiece([apron.thickness, apron.height, shortSpan], [x, railY, 0], piece('z')))
  }

  return { top: buildTabletop(), frame: mergeGeometries(parts, false) }
}
