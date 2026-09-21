import * as THREE from 'three'
import { fbm3 } from '../architecture/stoneNoise.js'

/**
 * The worktable's surface, drawn rather than downloaded.
 *
 * The room's stone is procedural for the same reason (`stoneNoise.js`): a
 * texture set for one prop is several hundred kilobytes that the visitor waits
 * for, and this table is a backdrop for work that has not been made yet. Wood
 * is also the easy case — it is one warped stripe pattern, which is a couple
 * of noise lookups, not a scan.
 *
 * Two maps, because wood reads through its FINISH as much as its colour: the
 * grain is nearly monochrome on an aged dark table, and what actually shows it
 * is that the open grain holds less sheen than the wood between it. A colour
 * map alone gives a printed-looking surface; the roughness map is what makes
 * it read as timber under a raking light.
 */

const SIZE = 512

/**
 * Wood is rings distorted by the tree's own irregularity: a coordinate that
 * increases across the grain, warped by low-frequency noise, then folded. The
 * warp is what stops it reading as a barcode — without it every stripe is
 * dead straight and the eye names it immediately.
 */
function grainAt(u, v) {
  // BOARDS first. A single continuous grain field over three square metres is
  // what makes a procedural table read as a contour map: real rings are only
  // ever continuous within one plank, and it is the seams — and the fact that
  // the grain on either side of one has nothing to do with its neighbour —
  // that say "timber" before any of the detail does.
  const board = Math.floor(v * BOARDS)
  const acrossBoard = v * BOARDS - board
  // Each plank gets its own ring phase, spacing and wander, keyed off its
  // index, so no two are cut from the same part of the log.
  const phase = fbm3(board * 12.7, 0, 0, 1, 31)
  const spacing = 5.0 + fbm3(board * 3.3, 0, 9.1, 1, 41) * 5.5

  const wander = (fbm3(u * 1.35, acrossBoard * 0.9 + board * 4.1, 0, 3, 7) - 0.5) * 0.9
  const rings = (acrossBoard * spacing + phase * 7 + wander) % 1
  const folded = Math.abs(rings * 2 - 1)
  const band = Math.pow(folded, 1.5)

  // Fine fibre along the board, well above the ring frequency.
  const fibre = fbm3(u * 130, acrossBoard * 6 + board * 2.7, 3.1, 3, 19) - 0.5

  // The seam itself: a narrow dark line where two planks meet.
  const toSeam = Math.min(acrossBoard, 1 - acrossBoard)
  const seam = 1 - THREE.MathUtils.smoothstep(toSeam, 0, SEAM_WIDTH)

  // Low contrast on purpose. This is a dark, worked surface under one warm
  // light; grain that announces itself pulls the eye off the work laid on it,
  // which is the opposite of what the table is for.
  const grain = 0.5 + (band - 0.5) * 0.34 + fibre * 0.14
  return THREE.MathUtils.clamp(grain - seam * 0.55, 0, 1)
}

/** Planks across the table's depth, and how wide the line between two is. */
const BOARDS = 5
const SEAM_WIDTH = 0.018

function draw(shade) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')
  const image = context.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const g = grainAt(x / SIZE, y / SIZE)
      const [r, gr, b] = shade(g, x / SIZE, y / SIZE)
      const i = (y * SIZE + x) * 4
      image.data[i] = r
      image.data[i + 1] = gr
      image.data[i + 2] = b
      image.data[i + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

let maps = null

/**
 * A dark, aged, neutral-brown worktable — deliberately not the orange of new
 * oak, which would fight the warm stone it has to sit alongside, and not a
 * flat black either, which loses the grain the brief asks to keep subtle but
 * present.
 */
export function tableWoodMaps() {
  if (maps) return maps
  const colour = draw((g) => {
    // Between a near-black in the open grain and a low, slightly red-shifted
    // brown on the face. Values are sRGB bytes; the shading does the rest.
    const base = THREE.MathUtils.lerp(0.052, 0.118, g)
    return [Math.round(base * 255 * 1.0), Math.round(base * 255 * 0.86), Math.round(base * 255 * 0.72)]
  })
  colour.colorSpace = THREE.SRGBColorSpace

  const roughness = draw((g) => {
    // The grain is the ROUGH part; the wood between it has been worked
    // smooth. A satin finish overall — never a polish.
    const r = Math.round(THREE.MathUtils.lerp(0.56, 0.76, 1 - g) * 255)
    return [r, r, r]
  })
  roughness.colorSpace = THREE.NoColorSpace

  maps = { colour, roughness }
  return maps
}
