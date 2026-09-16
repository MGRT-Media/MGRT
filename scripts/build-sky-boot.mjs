/**
 * Builds the boot sky from the 1K HDRI in `asset-sources/`.
 *
 * The sky arrives twice: a 512x256 version that the opening frame is drawn
 * with (191KB on the wire against 915KB, measured, and the single largest
 * saving available before the reveal), and the original, which replaces it
 * once the room is on screen — see `skyEnvironment.js`.
 *
 * Both the visible dome and the PMREM environment come from this one file, so
 * the boot version is a faithful downsample and not a different sky: pixels
 * are averaged in LINEAR light, which is the only way to average an HDR image
 * without shifting its exposure. Averaging the RGBE bytes directly would
 * darken every pixel whose neighbours share no exponent.
 *
 *     node scripts/build-sky-boot.mjs
 *
 * Radiance RGBE is read and written here rather than with an image library
 * because none of the usual ones handle it, and the format is small: a text
 * header, then either flat RGBE quads or the run-length encoding below.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'asset-sources/environment/evening-road-puresky-1k.hdr')
const OUT = join(ROOT, 'public/environment/evening-road-puresky-512.hdr')

/** How much smaller the boot sky is, per axis. */
const FACTOR = 2

function readHDR(buffer) {
  let at = 0
  const line = () => {
    let text = ''
    while (buffer[at] !== 10) text += String.fromCharCode(buffer[at++])
    at += 1
    return text
  }
  if (!line().startsWith('#?')) throw new Error('not a Radiance file')
  while (line() !== '') { /* header lines, then a blank one */ }
  const [, height, , width] = line().trim().split(/\s+/)
  const [W, H] = [Number(width), Number(height)]
  const data = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y += 1) {
    const row = y * W * 4
    const rle = buffer[at] === 2 && buffer[at + 1] === 2 && ((buffer[at + 2] << 8) | buffer[at + 3]) === W
    if (rle && W >= 8 && W < 32768) {
      at += 4
      // Run-length encoded, one channel at a time across the whole scanline.
      for (let channel = 0; channel < 4; channel += 1) {
        let x = 0
        while (x < W) {
          let count = buffer[at++]
          if (count > 128) {
            const value = buffer[at++]
            count -= 128
            while (count--) data[row + (x++) * 4 + channel] = value
          } else {
            while (count--) data[row + (x++) * 4 + channel] = buffer[at++]
          }
        }
      }
    } else {
      for (let x = 0; x < W; x += 1) for (let c = 0; c < 4; c += 1) data[row + x * 4 + c] = buffer[at++]
    }
  }
  return { W, H, data }
}

/** RGBE -> linear float. The 136 is the format's 128 bias plus the 8 bits of mantissa. */
function toLinear(data, i) {
  const exponent = data[i + 3]
  if (exponent === 0) return [0, 0, 0]
  const scale = 2 ** (exponent - 136)
  return [data[i] * scale, data[i + 1] * scale, data[i + 2] * scale]
}

function toRGBE(r, g, b) {
  const peak = Math.max(r, g, b)
  if (peak < 1e-32) return [0, 0, 0, 0]
  const exponent = Math.ceil(Math.log2(peak)) + 1
  const scale = 2 ** -exponent * 256
  // Rounded, not truncated. Truncating loses half a mantissa step on every
  // channel of every texel in the same direction, and the bias is measurable:
  // it made the boot sky 0.59% darker than the original in solid-angle-weighted
  // mean luminance, which is a real exposure difference between the sky the
  // room opens with and the one that replaces it.
  return [
    Math.min(255, Math.round(r * scale)),
    Math.min(255, Math.round(g * scale)),
    Math.min(255, Math.round(b * scale)),
    exponent + 128,
  ]
}

function downsample({ W, H, data }, factor) {
  const w = W / factor
  const h = H / factor
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let R = 0
      let G = 0
      let B = 0
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const [r, g, b] = toLinear(data, ((y * factor + dy) * W + (x * factor + dx)) * 4)
          R += r
          G += g
          B += b
        }
      }
      const n = factor * factor
      const rgbe = toRGBE(R / n, G / n, B / n)
      const i = (y * w + x) * 4
      out[i] = rgbe[0]
      out[i + 1] = rgbe[1]
      out[i + 2] = rgbe[2]
      out[i + 3] = rgbe[3]
    }
  }
  return { W: w, H: h, data: out }
}

function writeHDR({ W, H, data }) {
  const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'ascii')
  const rows = []
  for (let y = 0; y < H; y += 1) {
    const parts = [Buffer.from([2, 2, (W >> 8) & 255, W & 255])]
    for (let channel = 0; channel < 4; channel += 1) {
      const line = Buffer.alloc(W)
      for (let x = 0; x < W; x += 1) line[x] = data[(y * W + x) * 4 + channel]
      let x = 0
      while (x < W) {
        let run = 1
        while (x + run < W && line[x + run] === line[x] && run < 127) run += 1
        if (run >= 4) {
          parts.push(Buffer.from([128 + run, line[x]]))
          x += run
        } else {
          // A literal span, ending where four equal bytes in a row begin.
          let literal = 0
          const runStartsAt = (i) => i + 3 < W && line[i] === line[i + 1] && line[i] === line[i + 2] && line[i] === line[i + 3]
          while (x + literal < W && literal < 128 && !runStartsAt(x + literal)) literal += 1
          if (literal === 0) literal = 1
          parts.push(Buffer.from([literal]), Buffer.from(line.subarray(x, x + literal)))
          x += literal
        }
      }
    }
    rows.push(Buffer.concat(parts))
  }
  return Buffer.concat([header, ...rows])
}

const source = readHDR(readFileSync(SOURCE))
const boot = downsample(source, FACTOR)
writeFileSync(OUT, writeHDR(boot))
console.log(
  `${source.W}x${source.H} ${(statSync(SOURCE).size / 1024).toFixed(0)}KB -> ${boot.W}x${boot.H} ${(statSync(OUT).size / 1024).toFixed(0)}KB`,
)
