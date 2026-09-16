/**
 * Builds the shipped prop assets from the originals in `asset-sources/`.
 *
 * The opening composition shows the film camera at about 3% of the frame's
 * width and the monitor at roughly forty pixels, so the visitor cannot resolve
 * those models' 1024px maps until the close-ups at `FILM_FOCUS_T` (0.45) and
 * `MONITOR_SNAP_T` (0.60) — many seconds of scrolling later. Measured against
 * the capture harness's own run-to-run noise, 256px boot maps are
 * indistinguishable at every opening beat and only become measurable at those
 * close-ups.
 *
 * So each GLB ships with its textures at 256px and its full-resolution maps
 * beside it as separate files, which `propTextureUpgrades.js` installs while
 * the model is still small in frame. Geometry is downloaded ONCE: the boot
 * file is not a second copy of the model, it is the model, and only its
 * texture payload arrives late. (A boot GLB plus a full GLB would have meant
 * downloading 1876KB of meshopt geometry twice — measured, and rejected.)
 *
 * What is NOT touched, deliberately: geometry, quantization, meshopt encoding,
 * hierarchy, node names, UVs, transforms, material parameters. Only the
 * texture images change, and the extracted full-resolution maps are the
 * ORIGINAL bytes — copied out, never re-encoded, because re-encoding these
 * already-efficient WebPs at native size was measured to make two of the three
 * files LARGER.
 *
 *     npm i --no-save @gltf-transform/core @gltf-transform/extensions \
 *       @gltf-transform/functions meshoptimizer sharp
 *     node scripts/build-prop-assets.mjs
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { textureCompress } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = join(ROOT, 'asset-sources/models')
const PUBLIC = join(ROOT, 'public/models')
const MANIFEST = join(ROOT, 'src/experience/models/propTextureManifest.js')

/** The largest a boot texture may be. See the note above for why 256. */
const BOOT_SIZE = 256

/**
 * glTF texture slots mapped to the three.js material properties `GLTFLoader`
 * assigns them to. `metallicRoughnessTexture` becomes two properties on one
 * texture, which is why this is a list rather than a name.
 */
const SLOTS = [
  { read: 'getBaseColorTexture', properties: ['map'] },
  { read: 'getMetallicRoughnessTexture', properties: ['metalnessMap', 'roughnessMap'] },
  { read: 'getNormalTexture', properties: ['normalMap'] },
  { read: 'getOcclusionTexture', properties: ['aoMap'] },
  { read: 'getEmissiveTexture', properties: ['emissiveMap'] },
]

/**
 * `digital-stone.glb`'s textures are never sampled: `useStonePedestal` replaces
 * the material with the floor's scanned stone and re-projects the UVs, so the
 * two 1024px maps embedded in it were downloaded on every visit and thrown
 * away. They are dropped rather than downscaled, and there is nothing to
 * upgrade later.
 */
const MODELS = [
  { key: 'camera', source: 'camera/movie-camera.glb', out: 'camera/movie-camera.glb', textures: 'boot' },
  { key: 'monitor', source: 'monitor/spark-computer.glb', out: 'monitor/spark-computer.glb', textures: 'boot' },
  { key: 'pedestal', source: 'pedestal/digital-stone.glb', out: 'pedestal/digital-stone.glb', textures: 'drop' },
]

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

const kb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`

const manifest = {}

for (const model of MODELS) {
  const sourcePath = join(SOURCES, model.source)
  const outPath = join(PUBLIC, model.out)
  const before = statSync(sourcePath).size

  if (model.textures === 'drop') {
    const doc = await io.read(sourcePath)
    for (const texture of doc.getRoot().listTextures()) texture.dispose()
    await io.write(outPath, doc)
    console.log(`${model.key.padEnd(9)} ${kb(before)} -> ${kb(statSync(outPath).size)}  (textures removed, none used)`)
    continue
  }

  // 1. The full-resolution maps, lifted out as their own files. Original bytes.
  const doc = await io.read(sourcePath)
  const textureDir = join(PUBLIC, dirname(model.out), 'textures')
  rmSync(textureDir, { recursive: true, force: true })
  mkdirSync(textureDir, { recursive: true })

  const materials = {}
  let fullBytes = 0
  for (const material of doc.getRoot().listMaterials()) {
    const name = material.getName()
    for (const { read, properties } of SLOTS) {
      const texture = material[read]()
      if (!texture) continue
      const image = Buffer.from(texture.getImage())
      const file = `${name}-${properties[0]}.webp`
      writeFileSync(join(textureDir, file), image)
      fullBytes += image.byteLength
      materials[name] = materials[name] ?? {}
      for (const property of properties) {
        materials[name][property] = `/models/${dirname(model.out)}/textures/${file}`
      }
    }
  }
  manifest[model.key] = materials

  // 2. The same document with its textures reduced to the boot size. Only the
  //    images change; `textureCompress` leaves samplers, UV sets and material
  //    parameters alone, and the geometry is written back through the same
  //    meshopt encoder it arrived with.
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, effort: 6, resize: [BOOT_SIZE, BOOT_SIZE], resizeFilter: 'lanczos3' }),
  )
  await io.write(outPath, doc)
  console.log(`${model.key.padEnd(9)} ${kb(before)} -> ${kb(statSync(outPath).size)} boot + ${kb(fullBytes)} full-resolution maps in ${Object.keys(materials).length} materials`)
}

writeFileSync(
  MANIFEST,
  `/**
 * Generated by \`scripts/build-prop-assets.mjs\` — do not edit by hand.
 *
 * Every full-resolution texture that was lifted out of a prop GLB, keyed by the
 * model and by the glTF material name it belongs to, then by the three.js
 * material property \`GLTFLoader\` assigns it to. \`propTextureUpgrades.js\`
 * installs these over the 256px maps the GLB ships with.
 */
export const PROP_TEXTURE_MANIFEST = ${JSON.stringify(manifest, null, 2)}
`,
)
console.log(`\nmanifest -> ${MANIFEST.replace(ROOT + '/', '')}`)
