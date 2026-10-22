/**
 * Builds the Creative Table studio's shipped textures from the Poly Haven
 * scans in `asset-sources/studio/` (sources and licences: `asset-sources/README.md`).
 *
 * Each set ships as the three files the existing scanned-texture loader reads
 * (`src/experience/materials/scannedStone.js`):
 *
 *   albedo.webp   colour
 *   normal.webp   OpenGL normal map
 *   orm.webp      occlusion (R), roughness (G), metalness (B)
 *
 * The scans carry no occlusion map, so R is white and B is black: the ORM file
 * is the roughness map in the channel the loader expects.
 *
 * Resolution follows how close the camera gets. The walls are never nearer
 * than a couple of metres and a 1.5 m tile at 1024px is already finer than the
 * screen can resolve there; its relief and roughness are broad and soft, and
 * ship smaller still. The tabletop is the subject of the close stages,
 * and its grain is a pattern of fine lines, so its colour stays at 2048px.
 *
 * Quality follows the measured rules in `docs/technical-architecture.md` §9:
 * normals at 90, roughness at 85, sharp-YUV on both.
 *
 * Sources are Poly Haven scans unless a set names its own `files` (the
 * ambientCG stone does).
 *
 * The walnut scan is nearly neutral and low in contrast (a pale grey veneer
 * with straight grain). Its colour is set by the material's tint at runtime;
 * here its contrast is widened so the grain survives being tinted dark.
 *
 * Run when a source changes, not on every build:
 *
 *     npm i --no-save sharp
 *     node scripts/build-studio-textures.mjs
 */
import sharp from 'sharp'
import { mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = join(ROOT, 'asset-sources/studio')
const PUBLIC = join(ROOT, 'public/textures/studio')

const SETS = [
  { source: 'plaster_grey_04', out: 'plaster', albedoSize: 1024, normalSize: 768, ormSize: 512 },
  // `grainContrast` scales the colour's distance from mid-grey.
  { source: 'european_walnut_veneer_05', out: 'walnut', albedoSize: 2048, normalSize: 1024, ormSize: 1024, grainContrast: 2.2 },
  // ambientCG Marble 024. Its own finish is polished (roughness about 0.11);
  // `honed` re-centres the roughness on `mean` and scales its variation by
  // `spread`, for a honed, low-sheen slab. Its colour is very even, so its
  // contrast is widened to keep the faint veining readable once tinted.
  {
    source: 'marble_024',
    files: { colour: 'Color', normal: 'NormalGL', roughness: 'Roughness' },
    out: 'stone',
    albedoSize: 2048,
    normalSize: 1024,
    ormSize: 1024,
    grainContrast: 2.4,
    // Widening the contrast per channel also pushes its warm cast; this pulls
    // the saturation back so the tint, not the scan, decides the colour.
    saturation: 0.5,
    honed: { mean: 0.62, spread: 2.5 },
  },
]

function report(path) {
  console.log(`${path.replace(ROOT + '/', '').padEnd(46)} ${(statSync(path).size / 1000).toFixed(1).padStart(7)} kB`)
}

const POLY_HAVEN_FILES = { colour: 'Diffuse', normal: 'nor_gl', roughness: 'Rough' }

for (const { source, files = POLY_HAVEN_FILES, out, albedoSize, normalSize, ormSize, grainContrast, saturation, honed } of SETS) {
  const from = (map) => join(SOURCES, source, `${files[map]}.jpg`)
  const to = (name) => join(PUBLIC, out, `${name}.webp`)
  mkdirSync(join(PUBLIC, out), { recursive: true })

  let albedo = sharp(from('colour')).resize(albedoSize, albedoSize)
  if (grainContrast) {
    const { channels } = await sharp(from('colour')).stats()
    const mean = channels.reduce((sum, channel) => sum + channel.mean, 0) / channels.length
    albedo = albedo.linear(grainContrast, mean * (1 - grainContrast))
  }
  if (saturation !== undefined) albedo = sharp(await albedo.toBuffer()).modulate({ saturation })
  await albedo.webp({ quality: 84, effort: 6 }).toFile(to('albedo'))
  report(to('albedo'))

  await sharp(from('normal'))
    .resize(normalSize, normalSize)
    .webp({ quality: 90, smartSubsample: true, effort: 6 })
    .toFile(to('normal'))
  report(to('normal'))

  let roughness = await sharp(from('roughness')).resize(ormSize, ormSize).greyscale().raw().toBuffer()
  if (honed) {
    const average = roughness.reduce((sum, value) => sum + value, 0) / roughness.length
    roughness = roughness.map((value) => Math.max(0, Math.min(255, Math.round(honed.mean * 255 + (value - average) * honed.spread))))
  }
  const orm = Buffer.alloc(ormSize * ormSize * 3)
  for (let i = 0; i < roughness.length; i += 1) {
    orm[i * 3] = 255
    orm[i * 3 + 1] = roughness[i]
  }
  await sharp(orm, { raw: { width: ormSize, height: ormSize, channels: 3 } })
    .webp({ quality: 85, smartSubsample: true, effort: 6 })
    .toFile(to('orm'))
  report(to('orm'))
}
