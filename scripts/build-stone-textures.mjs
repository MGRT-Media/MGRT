/**
 * Re-encodes the room's stone DATA textures from the originals in
 * `asset-sources/textures/`.
 *
 * Only the normal and ORM maps. The albedos are left exactly as they are:
 * measured, re-encoding walls' and columns' albedo at any quality that keeps
 * them faithful makes them LARGER, and the floor's saves 4.6kB, which is not
 * worth a second encoding of a colour map the camera sits inches from.
 *
 * **What saves the bytes is the quality setting**, nothing cleverer: the
 * originals were encoded higher than these maps need, and normals at 90 with
 * ORM at 85 takes the six from 1,546,954 to 1,294,360 bytes.
 *
 * `smartSubsample` is NOT a 4:4:4 switch, and an earlier version of this
 * comment wrongly said it was. Lossy WebP is VP8, and VP8 is always YUV 4:2:0
 * — the bitstream has no subsampling field to set. The option maps to
 * libwebp's `use_sharp_yuv`, a better-conditioned 4:2:0 chroma downsample.
 * Measured on an alternating-column image whose two colours differ only in
 * chroma, the default encoder keeps 0% of that per-pixel chroma and this
 * option keeps 6.6%; true 4:4:4 (lossless VP8L) keeps 100%. A refinement of
 * 4:2:0, not an escape from it.
 *
 * It stays because at MATCHED FILE SIZE it is the better encode for five of
 * the six — walls/normal 1.534 against 1.594 degrees of angular error,
 * columns/normal 1.43 against 1.844, floors/normal 0.785 against 0.821,
 * columns/orm 1.570 against 1.703, floors/orm 1.377 against 1.469 — the
 * exception being walls/orm, at 1.123 against 1.079. It costs about 93KB
 * across the six at a given quality, so the quality drop alone would have
 * saved ~345KB and this hands ~93KB of that back for lower chroma error.
 *
 * Why chroma matters here at all: in these files the channels ARE the data. A
 * normal map's red and green are the surface's X and Y tilt, and the ORM's red
 * and green are ambient occlusion and roughness (it is bound to `aoMap` AND
 * `roughnessMap` — see `stoneWallMaterial.js`).
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
      // smartSubsample = libwebp's use_sharp_yuv: a sharper 4:2:0 chroma
      // downsample, not 4:4:4. See the note above.
      .webp({ quality, smartSubsample: true, effort: 6 })
      .toFile(out)
    const now = statSync(out).size
    before += was
    after += now
    console.log(`${set}/${name}`.padEnd(16) + `q${quality} sharp-yuv  ${was} -> ${now} B  (${((now - was) / 1000).toFixed(1)} kB)`)
  }
}
console.log(`\ntotal ${before} -> ${after} B, saving ${before - after} B = ${((before - after) / 1000).toFixed(1)} kB`)
