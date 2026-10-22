/**
 * Builds the physical MGRT / MEDIA wall lettering, `public/models/studio/
 * wall-lettering.glb`, from the Cormorant Medium outlines in
 * `asset-sources/studio/wordmark-outlines.json`.
 *
 * The setting is the established wordmark's, read from the same definition
 * the scene uses (`LETTERING` in `src/experience/studio/studioLayout.js`):
 * each letter placed by its own advance plus the line's tracking, each line
 * scaled to its share of the block's width, and the lines stacked at their
 * set heights. So the model's footprint on the wall is the placeholder's.
 *
 * Each letter is extruded to the lettering's depth with a small chamfer on its
 * front and back edges. The model is in metres, centred on the block's centre,
 * with its back face `depth / 2` behind the origin — the scene places it by
 * `LETTERING_CENTER`.
 *
 * Geometry only: one mesh, positions and normals, no material or texture. The
 * finish is the scene's to decide.
 *
 * Run when the outlines or the setting change, not on every build. It uses
 * only `three`, which the app already depends on:
 *
 *     node scripts/build-wall-lettering.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LETTERING, LETTERING_HEIGHT } from '../src/experience/studio/studioLayout.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUTLINES = join(ROOT, 'asset-sources/studio/wordmark-outlines.json')
const OUT = join(ROOT, 'public/models/studio/wall-lettering.glb')

// The chamfer: how far it cuts into the face, and how deep it runs.
const BEVEL_SIZE = 0.0014
const BEVEL_THICKNESS = 0.0016
// Segments per curve of the outline. The letters are a quarter of a metre
// tall and seen from metres away; beyond this the facets are sub-pixel.
const CURVE_SEGMENTS = 6
// Edges sharper than this stay edges; anything gentler shades as a curve.
const CREASE_ANGLE = THREE.MathUtils.degToRad(32)

const font = JSON.parse(readFileSync(OUTLINES, 'utf8'))
if (font.weight !== LETTERING.fontWeight) {
  throw new Error(`outlines are weight ${font.weight}, the wordmark is set in ${LETTERING.fontWeight}`)
}
const em = font.unitsPerEm

/** One letter's contours as shapes with their holes, in font units. */
function letterShapes(letter) {
  const path = new THREE.ShapePath()
  for (const contour of font.glyphs[letter].contours) {
    for (const [type, ...p] of contour) {
      if (type === 'M') path.moveTo(p[0], p[1])
      else if (type === 'L') path.lineTo(p[0], p[1])
      else if (type === 'Q') path.quadraticCurveTo(p[0], p[1], p[2], p[3])
      else if (type === 'C') path.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5])
    }
    path.currentPath.closePath()
  }
  return path.toShapes(false)
}

// A canvas's 'middle' text baseline — what the placeholder was drawn against —
// is the middle of the em square, this far above the alphabetic baseline.
const middleAboveBaseline = (font.ascent - font.descent) / (2 * (font.ascent + font.descent))

const parts = []
for (const line of LETTERING.lines) {
  const letters = [...line.text]
  const advances = letters.reduce((sum, letter) => sum + font.glyphs[letter].advance, 0)
  const tracking = line.tracking * em
  // Metres per font unit, so the line spans its share of the block's width.
  const scale = (LETTERING.width * line.fill) / (advances + tracking * (letters.length - 1))
  const lineWidth = scale * (advances + tracking * (letters.length - 1))
  const baselineY = LETTERING_HEIGHT / 2 - LETTERING_HEIGHT * line.baseline - middleAboveBaseline * em * scale

  let x = -lineWidth / 2
  for (const letter of letters) {
    const geometry = new THREE.ExtrudeGeometry(letterShapes(letter), {
      depth: LETTERING.depth / scale - 2 * (BEVEL_THICKNESS / scale),
      bevelEnabled: true,
      bevelSize: BEVEL_SIZE / scale,
      bevelThickness: BEVEL_THICKNESS / scale,
      // The chamfer cuts inward, so the letter keeps its drawn outline.
      bevelOffset: -BEVEL_SIZE / scale,
      bevelSegments: 1,
      curveSegments: CURVE_SEGMENTS,
    })
    geometry.deleteAttribute('uv')
    geometry.scale(scale, scale, scale)
    // Extrusion runs from z = -bevel to depth + bevel; centre it on z = 0.
    geometry.translate(x, baselineY, -LETTERING.depth / 2 + BEVEL_THICKNESS)
    parts.push(geometry)
    x += scale * (font.glyphs[letter].advance + tracking)
  }
}

const merged = mergeVertices(toCreasedNormals(mergeGeometries(parts, false), CREASE_ANGLE), 1e-5)
merged.computeBoundingBox()
const { min, max } = merged.boundingBox

// --- A minimal binary glTF: one mesh, indexed, positions and normals ---------
// Kept small without a compression dependency: 16-bit indices, and normals as
// normalised signed bytes (padded to four per vertex, as glTF requires), which
// is ample precision for a direction.
const positions = merged.attributes.position.array
if (positions.length / 3 > 65535) throw new Error('too many vertices for 16-bit indices')
const indices = Uint16Array.from(merged.index.array)
const normals = new Int8Array((positions.length / 3) * 4)
merged.attributes.normal.array.forEach((value, i) => {
  normals[Math.floor(i / 3) * 4 + (i % 3)] = Math.round(value * 127)
})
const align = (buffer) => Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4)])
const chunks = [indices, positions, normals].map((array) => align(Buffer.from(array.buffer, array.byteOffset, array.byteLength)))
const offsets = [0, chunks[0].length, chunks[0].length + chunks[1].length]
const binary = Buffer.concat(chunks)
const count = positions.length / 3

const gltf = {
  asset: { version: '2.0', generator: 'scripts/build-wall-lettering.mjs' },
  extensionsUsed: ['KHR_mesh_quantization'],
  extensionsRequired: ['KHR_mesh_quantization'],
  extras: { source: `${font.font}, weight ${font.weight}`, licence: 'SIL Open Font License 1.1' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'WallLettering', mesh: 0 }],
  meshes: [{ name: 'WallLettering', primitives: [{ attributes: { POSITION: 1, NORMAL: 2 }, indices: 0 }] }],
  buffers: [{ byteLength: binary.length }],
  bufferViews: [
    { buffer: 0, byteOffset: offsets[0], byteLength: indices.byteLength, target: 34963 },
    { buffer: 0, byteOffset: offsets[1], byteLength: chunks[1].length, target: 34962 },
    { buffer: 0, byteOffset: offsets[2], byteLength: chunks[2].length, byteStride: 4, target: 34962 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5123, count: indices.length, type: 'SCALAR' },
    { bufferView: 1, componentType: 5126, count, type: 'VEC3', min: min.toArray(), max: max.toArray() },
    { bufferView: 2, componentType: 5120, normalized: true, count, type: 'VEC3' },
  ],
}

const pad = (buffer, fill) => Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4, fill)])
const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20)
const bin = pad(binary, 0)
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8)
const chunkHeader = (length, type) => {
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32LE(length, 0)
  buffer.writeUInt32LE(type, 4)
  return buffer
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, Buffer.concat([header, chunkHeader(json.length, 0x4e4f534a), json, chunkHeader(bin.length, 0x004e4942), bin]))

const size = max.clone().sub(min)
console.log(`${font.font}, weight ${font.weight}`)
console.log(`block ${LETTERING.width} x ${LETTERING_HEIGHT.toFixed(3)} m  ->  letters span ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)} m`)
console.log(`x ${min.x.toFixed(3)}..${max.x.toFixed(3)}  y ${min.y.toFixed(3)}..${max.y.toFixed(3)}  z ${min.z.toFixed(4)}..${max.z.toFixed(4)}`)
console.log(`${count} vertices, ${indices.length / 3} triangles, ${(12 + 8 + json.length + 8 + bin.length) / 1000} kB`)
