/**
 * Noise primitives for weathered stone.
 *
 * These are 3D on purpose. An earlier pass built column relief from sums of
 * sines in (angle, height) space, which fails twice: sine sums are smooth and
 * periodic by construction, so they produce rolling hills and exactly
 * repeating vertical channels — the "clean procedural pattern" look — and any
 * field defined on an angle needs its frequencies forced to integers to avoid
 * a seam up the shaft, which locks the pattern into perfect rotational
 * symmetry.
 *
 * Sampling a 3D field at the vertex's own position solves both. It is
 * seamless on any closed surface automatically, with no constraint on
 * frequency, so nothing is forced to repeat.
 *
 * Three characters are needed, because stone does not have one:
 *  - `fbm3`    — ordinary layered noise: bulges, contours, broad wear.
 *  - `ridged3` — sharp creases. Folding the noise about zero (`1 - |n|`)
 *                turns smooth zero-crossings into hard ridge lines, which is
 *                what cracks and fracture edges actually look like. Plain fbm
 *                cannot make a crack; it has no sharp features anywhere.
 *  - `pits3`   — thresholded and shaped, for pockets and spalled patches:
 *                mostly nothing, occasionally a deep bite with a defined edge.
 */

/** Integer lattice hash — cheap, deterministic, decorrelated enough for relief. */
function hash3(x, y, z, seed) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647 + seed * 981039611
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smootherstep — C2 continuous, so no lattice creases show in the normals. */
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function valueNoise3(x, y, z, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const w = fade(z - zi)

  const c000 = hash3(xi, yi, zi, seed)
  const c100 = hash3(xi + 1, yi, zi, seed)
  const c010 = hash3(xi, yi + 1, zi, seed)
  const c110 = hash3(xi + 1, yi + 1, zi, seed)
  const c001 = hash3(xi, yi, zi + 1, seed)
  const c101 = hash3(xi + 1, yi, zi + 1, seed)
  const c011 = hash3(xi, yi + 1, zi + 1, seed)
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed)

  const x00 = c000 + (c100 - c000) * u
  const x10 = c010 + (c110 - c010) * u
  const x01 = c001 + (c101 - c001) * u
  const x11 = c011 + (c111 - c011) * u
  const y0 = x00 + (x10 - x00) * v
  const y1 = x01 + (x11 - x01) * v
  return y0 + (y1 - y0) * w
}

/** Layered value noise, returned centred on zero in roughly [-1, 1]. */
export function fbm3(x, y, z, octaves, seed) {
  let sum = 0
  let amplitude = 1
  let total = 0
  let frequency = 1
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * (valueNoise3(x * frequency, y * frequency, z * frequency, seed + i * 37) * 2 - 1)
    total += amplitude
    amplitude *= 0.5
    frequency *= 2.03 // not exactly 2, so octaves never re-align into a grid
  }
  return sum / total
}

/**
 * Ridged multifractal. Each octave is folded about zero and squared, so the
 * field is mostly flat with sharp creases where the underlying noise crosses
 * zero — cracks, fracture lines, the arrises left where stone has split.
 * Returned in [0, 1], where 1 is the crest of a ridge.
 */
export function ridged3(x, y, z, octaves, seed) {
  let sum = 0
  let amplitude = 1
  let total = 0
  let frequency = 1
  for (let i = 0; i < octaves; i += 1) {
    const n = valueNoise3(x * frequency, y * frequency, z * frequency, seed + i * 53) * 2 - 1
    const ridge = 1 - Math.abs(n)
    sum += amplitude * ridge * ridge
    total += amplitude
    amplitude *= 0.52
    frequency *= 2.07
  }
  return sum / total
}

/**
 * Sparse pockets. Thresholding leaves most of the surface untouched, and the
 * cubic shaping past the threshold makes the few hits deep with a defined
 * edge — the difference between a surface that is merely bumpy and one that
 * has had material taken out of it. Returns 0 almost everywhere, up to 1 in a
 * pocket.
 */
export function pits3(x, y, z, seed, threshold = 0.42) {
  const n = (fbm3(x, y, z, 3, seed) + 1) * 0.5
  if (n <= threshold) return 0
  const t = (n - threshold) / (1 - threshold)
  return t * t * t
}
