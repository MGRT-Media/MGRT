/**
 * Re-encodes the room's stone DATA textures from the originals in
 * `asset-sources/textures/`.
 *
 * Only the normal and ORM maps. The albedos are left exactly as they are:
 * measured, re-encoding walls' and columns' albedo at any quality that keeps
 * them faithful makes them LARGER, and the floor's saves 4.6kB, which is not
 * worth a second encoding of a colour map the camera sits inches from.
 *
 * **The setting that matters is the chroma subsampling, not the quality.**
 * WebP's lossy mode defaults to 4:2:0 — it halves the resolution of the two
 * chroma planes, which is fine for a photograph, where chroma carries little
 * detail, and wrong for these files, where the channels ARE the data: a normal
 * map's red and green are the surface's X and Y tilt, and the ORM's red and
 * green are ambient occlusion and roughness. `smartSubsample` keeps 4:4:4, and
 * measured against the originals it beats 4:2:0 on quality per byte for every
 * one of these six maps.
 *
 * Quality is then chosen per map type, from how the map is used rather than
 * from one number applied to everything:
 *
 * - NORMALS at 90. Shading the maps directly under the room's own sun, q85
 *   doubles the share of texels whose luminance moves by more than 8/255
 *   (walls 4.6% -> 12.8%, columns 5.3% -> 13.8%). That is the micro-relief
 *   this stone is built from, so the extra ~100kB q85 would have saved is not
 *   taken.
 * - ORM at 85. The same test says the difference is nothing: shading with a
 *   q85 ORM instead of a q90 one moves the wall's mean error from 2.623 to
 *   2.655 of 255. Occlusion and roughness are low-frequency terms — one
 *   attenuates ambient at 0.7 intensity, the other blurs a highlight — so they
 *   tolerate what a normal map does not.
 *
 * Dimensions (1024x1024), channel assignments, orientation and the absence of
 * an alpha channel are all preserved; nothing here resizes or reorders
 * anything.
 *
 *     npm i --no-save sharp
 *     node scripts/build-stone-textures.mjs
 */
import sharp from 'sharp'
import { statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = join(ROOT, 'asset-sources/textures')
const PUBLIC = join(ROOT, 'public/textures')

const SETS = ['walls', 'columns', 'floors']
const MAPS = [
  { name: 'normal', quality: 90 },
  { name: 'orm', quality: 85 },
]

let before = 0
let after = 0
for (const set of SETS) {
  for (const { name, quality } of MAPS) {
    const source = join(SOURCES, set, `${name}.webp`)
    const out = join(PUBLIC, set, `${name}.webp`)
    const was = statSync(source).size
    await sharp(source)
      .webp({ quality, smartSubsample: true, effort: 6 })
      .toFile(out)
    const now = statSync(out).size
    before += was
    after += now
    console.log(`${set}/${name}`.padEnd(16) + `q${quality} 4:4:4  ${was} -> ${now} B  (${((now - was) / 1000).toFixed(1)} kB)`)
  }
}
console.log(`\ntotal ${before} -> ${after} B, saving ${before - after} B = ${((before - after) / 1000).toFixed(1)} kB`)
