import * as THREE from 'three'

/**
 * Procedurally generated old-stone PBR material — albedo, normal, and
 * roughness maps, all built from the same layered value-noise height
 * field at module load, no external texture assets. This project has no
 * existing texture pipeline (every material so far is either a flat
 * color or a custom procedural shader — the beam, floor pool, dust, and
 * monitor screen are all built this way), and CLAUDE.md's "reuse
 * existing assets, avoid unnecessary dependencies" guidance argues
 * against introducing image-file textures and a loader for a single
 * material. Generating real `DataTexture` normal/roughness maps at
 * runtime satisfies the request literally (actual PBR maps, not just a
 * tinted color) while staying consistent with the codebase's existing
 * all-procedural approach.
 */

const TEXTURE_SIZE = 256

/** Deterministic 2D hash → pseudo-random value in [0, 1). */
function hash2D(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** Smoothly interpolated value noise over an integer lattice. */
function valueNoise(x, y) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)

  const n00 = hash2D(x0, y0)
  const n10 = hash2D(x0 + 1, y0)
  const n01 = hash2D(x0, y0 + 1)
  const n11 = hash2D(x0 + 1, y0 + 1)

  const nx0 = THREE.MathUtils.lerp(n00, n10, sx)
  const nx1 = THREE.MathUtils.lerp(n01, n11, sx)
  return THREE.MathUtils.lerp(nx0, nx1, sy)
}

/** Fractal Brownian motion — layered octaves of value noise for natural, non-repeating variation. */
function fbm(x, y, octaves) {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  for (let i = 0; i < octaves; i += 1) {
    value += valueNoise(x * frequency, y * frequency) * amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return value
}

// One texture-repeat cycle (0–1 UV) = one stone block, per the request's
// "mortar lines and individual stone blocks appropriately proportioned" —
// `createStoneWallMaterial`'s `repeat` then directly sets how many blocks
// tile across a given wall's physical size, tied to `TILE_SIZE` below.
const MORTAR_WIDTH = 0.045
const MORTAR_GROOVE_DEPTH = 0.6

/**
 * 0 right at a block edge, ramping up to 1 once `width` into the block's
 * interior — used to recess the height field near tile borders so mortar
 * reads as a genuine groove (in the normal map) and a genuine dark line
 * (in the albedo, via the existing height→shade relationship) rather than
 * a texture that has no block structure at all.
 */
function mortarMask(u, v, width) {
  const du = Math.min(u, 1 - u)
  const dv = Math.min(v, 1 - v)
  const d = Math.min(du, dv)
  return THREE.MathUtils.smoothstep(d, 0, width)
}

/** Builds the shared height field once, sized `TEXTURE_SIZE` × `TEXTURE_SIZE`. */
function buildHeightField() {
  const height = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE)
  const scale = 6 / TEXTURE_SIZE
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const u = x / TEXTURE_SIZE
      const v = y / TEXTURE_SIZE
      const surfaceNoise = fbm(x * scale, y * scale, 5)
      const mask = mortarMask(u, v, MORTAR_WIDTH)
      height[y * TEXTURE_SIZE + x] = surfaceNoise * mask - (1 - mask) * MORTAR_GROOVE_DEPTH
    }
  }
  return height
}

function buildAlbedoTexture(height) {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  // Aged, mottled gray-tan stone base, darkened/lightened by the height
  // field — brightened from the previous round's base/range specifically
  // for readability (the request flagged the walls reading as "flat
  // black"): mortar grooves (negative height, see buildHeightField) now
  // shade down to a visibly dark line rather than the whole wall sitting
  // uniformly dim.
  const base = new THREE.Color('#948c7c')
  for (let i = 0; i < TEXTURE_SIZE * TEXTURE_SIZE; i += 1) {
    const h = height[i]
    const shade = THREE.MathUtils.clamp(0.78 + h * 0.55, 0.32, 1.3)
    data[i * 4] = THREE.MathUtils.clamp(base.r * 255 * shade, 0, 255)
    data[i * 4 + 1] = THREE.MathUtils.clamp(base.g * 255 * shade, 0, 255)
    data[i * 4 + 2] = THREE.MathUtils.clamp(base.b * 255 * shade, 0, 255)
    data[i * 4 + 3] = 255
  }
  const texture = new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Roughness sampled from a second, differently-offset noise field so it
 * doesn't just track the albedo 1:1 — kept in a fairly narrow, high band
 * (0.72–0.95) so the stone catches specular highlights cleanly without
 * artificial gloss, per the request, rather than spanning down toward
 * shiny/polished values anywhere.
 */
function buildRoughnessTexture() {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  const scale = 6 / TEXTURE_SIZE
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const n = fbm(x * scale + 41.2, y * scale + 17.7, 4)
      const roughness = 0.72 + n * 0.23
      const v = Math.round(roughness * 255)
      const i = (y * TEXTURE_SIZE + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat)
}

/** Standard finite-difference normal map derived from the same height field. */
function buildNormalTexture(height) {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  const strength = 1.8
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const xL = height[y * TEXTURE_SIZE + Math.max(0, x - 1)]
      const xR = height[y * TEXTURE_SIZE + Math.min(TEXTURE_SIZE - 1, x + 1)]
      const yD = height[Math.max(0, y - 1) * TEXTURE_SIZE + x]
      const yU = height[Math.min(TEXTURE_SIZE - 1, y + 1) * TEXTURE_SIZE + x]
      const dx = (xR - xL) * strength
      const dy = (yU - yD) * strength

      const normal = new THREE.Vector3(-dx, -dy, 1).normalize()
      const i = (y * TEXTURE_SIZE + x) * 4
      data[i] = Math.round((normal.x * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round((normal.y * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round((normal.z * 0.5 + 0.5) * 255)
      data[i + 3] = 255
    }
  }
  return new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat)
}

/**
 * Creates one old-stone `MeshStandardMaterial` with generated map/
 * normalMap/roughnessMap. `tintColor` is multiplied with the generated
 * albedo (`MeshStandardMaterial.color` × `.map` is Three.js's default
 * behavior) so the existing three-tier wall tonality from Phase 1B
 * (`SURFACE_TONE.wallBack`/`wallSide`) still comes through under the new
 * stone detail, rather than the two being replaced outright.
 *
 * `repeat` is in texture-repeat units, where one repeat cycle = one stone
 * block (see `MORTAR_WIDTH`/`MORTAR_GROOVE_DEPTH` above) — callers should
 * derive it from a wall's actual physical size so block scale stays
 * consistent relative to the pillars, rather than passing an arbitrary
 * count; see `stoneRepeatForSize` and its call sites in `Environment.jsx`.
 *
 * `normalScale` raises the normal map's perturbation strength above the
 * `MeshStandardMaterial` default of `(1, 1)` so incoming light — especially
 * the raking angle from the breach — visibly catches the mortar grooves
 * and block-face variation, per the request.
 */
export function createStoneWallMaterial(tintColor, repeat = [6, 3], normalScale = [1.4, 1.4]) {
  const height = buildHeightField()
  const map = buildAlbedoTexture(height)
  const normalMap = buildNormalTexture(height)
  const roughnessMap = buildRoughnessTexture()

  ;[map, normalMap, roughnessMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeat[0], repeat[1])
    texture.needsUpdate = true
  })

  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(normalScale[0], normalScale[1]),
    roughnessMap,
    color: tintColor,
    metalness: 0,
  })
}

/** One stone block ≈ `TILE_SIZE` world units — see the module doc comment. */
const TILE_SIZE = 1.4

/** Derives a `repeat` tuple from a wall segment's actual physical [width, height]. */
export function stoneRepeatForSize(width, height) {
  return [width / TILE_SIZE, height / TILE_SIZE]
}
