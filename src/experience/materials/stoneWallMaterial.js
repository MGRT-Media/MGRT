import * as THREE from 'three'
import { assetUrl } from '../assets/assetUrl.js'
import { trackAssetUpgrade } from '../loading/assetReadiness.js'
import {
  cloneScannedMaps,
  SCANNED_BASE,
  SCANNED_SLOTS,
  SCANNED_TILE_SIZE,
  scannedStoneReady,
} from './scannedStone.js'

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
function mortarMask(u, v, width, bond) {
  const dv = Math.min(v, 1 - v)
  // A drum column is a stack of cylindrical blocks: it has bed joints where
  // one drum meets the next, and no vertical joints at all, because each
  // drum is a single piece turned on a lathe. Masking on `v` alone gives
  // exactly that. The ashlar default keeps both axes, for coursed walling.
  if (bond === 'drum') return THREE.MathUtils.smoothstep(dv, 0, width)
  const du = Math.min(u, 1 - u)
  return THREE.MathUtils.smoothstep(Math.min(du, dv), 0, width)
}

/**
 * Sparse, hard-edged loss of material — the chips and spalled patches that
 * separate a weathered ruin from a merely bumpy surface.
 *
 * The surface noise already in the height field is smooth everywhere, which
 * is why it reads as "procedural": real erosion is not smooth, it takes
 * bites. Thresholding a second, differently-scaled noise field and cutting
 * only where it crosses that threshold gives sparse damage with a defined
 * edge, leaving most of the stone intact between hits.
 */
function chipField(x, y, scale, amount) {
  if (amount <= 0) return 0
  const n = fbm(x * scale * 2.7 + 91.3, y * scale * 2.7 - 47.9, 3)
  const bite = Math.max(0, n - 0.55) / 0.45
  return bite * bite * amount
}

/** Builds the shared height field once, sized `TEXTURE_SIZE` × `TEXTURE_SIZE`. */
function buildHeightField(bond, erosion) {
  const height = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE)
  const scale = 6 / TEXTURE_SIZE
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const u = x / TEXTURE_SIZE
      const v = y / TEXTURE_SIZE
      const surfaceNoise = fbm(x * scale, y * scale, 5)
      const mask = mortarMask(u, v, MORTAR_WIDTH, bond)
      const base = surfaceNoise * mask - (1 - mask) * MORTAR_GROOVE_DEPTH
      height[y * TEXTURE_SIZE + x] = base - chipField(x, y, scale, erosion)
    }
  }
  return height
}

/**
 * Weathering that lives in the albedo rather than the relief.
 *
 * A normal map is only visible where light arrives from a direction. The
 * room's dark state is carried almost entirely by ambient, which is
 * directionless by definition, so every gram of sculpted relief on these
 * columns is invisible for the whole opening — the surface flattens to its
 * base colour no matter how deeply it is modelled. Staining is the channel
 * that survives that, because it changes the colour itself.
 *
 * Two components, both what actually marks standing stone: streaks pulled
 * vertically by rain running down the shaft (hence the heavily anisotropic
 * sampling — stretched along y, compressed across x), and broader blotches
 * of discolouration where the surface has weathered unevenly.
 */
function stainAt(x, y, scale, amount) {
  if (amount <= 0) return 1
  const runoff = fbm(x * scale * 3.1 + 17.7, y * scale * 0.22 - 63.1, 4)
  const blotch = fbm(x * scale * 0.55 - 29.3, y * scale * 0.55 + 8.8, 3)
  const darken = runoff * 0.62 + blotch * 0.38
  return 1 - amount * 0.5 * darken
}

function buildAlbedoTexture(height, stain) {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  // Aged, mottled gray-tan stone base, darkened/lightened by the height
  // field — brightened from the previous round's base/range specifically
  // for readability (the request flagged the walls reading as "flat
  // black"): mortar grooves (negative height, see buildHeightField) now
  // shade down to a visibly dark line rather than the whole wall sitting
  // uniformly dim.
  const base = new THREE.Color('#948c7c')
  const scale = 6 / TEXTURE_SIZE
  for (let i = 0; i < TEXTURE_SIZE * TEXTURE_SIZE; i += 1) {
    const h = height[i]
    const x = i % TEXTURE_SIZE
    const y = (i - x) / TEXTURE_SIZE
    const shade = THREE.MathUtils.clamp(0.78 + h * 0.55, 0.32, 1.3) * stainAt(x, y, scale, stain)
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
/**
 * Scanned-stone upgrade.
 *
 * Everything above this point generates stone from a 256px value-noise field
 * in JavaScript. That is why these surfaces read as computed rather than
 * photographed: a closed-form noise function has no correlated structure
 * across scales, so it cannot produce the pore-to-block continuity that a
 * photogrammetry scan measures off real rock. No amount of extra octaves
 * fixes that — it is the wrong kind of data, not too little of it.
 *
 * So if a scanned set is present on disk, it replaces the generated maps.
 * The procedural material is still built first and returned synchronously,
 * which means:
 *  - the room looks exactly as it does today when no files are installed,
 *  - nothing suspends, blocks or throws on a missing file,
 *  - the swap happens in place the moment the textures finish decoding.
 *
 * See `public/textures/limestone/README.md` for what to install.
 */
function loadOptionalTexture(url) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(url, resolve, undefined, () => resolve(null))
  })
}

/**
 * One shared availability probe for the whole room.
 *
 * Every material would otherwise request all four maps, and a dev server that
 * answers unknown paths with the SPA's index.html answers *200* — so the
 * misses are not even cheap 404s, they are six materials fetching four copies
 * of an HTML document each. Checking `Content-Type` once and sharing the
 * promise turns twenty-four wasted requests into one.
 */
const scannedSetAvailable = new Map()

function isScannedStoneInstalled(set) {
  if (!scannedSetAvailable.has(set)) {
    // GET, not HEAD. Vite's static middleware aborts HEAD requests for files
    // in `public/` (net::ERR_ABORTED), which made this probe report "missing"
    // even with the set correctly installed and silently disabled the whole
    // upgrade. The GET costs nothing extra — the response is served straight
    // back out of the HTTP cache when TextureLoader asks for the same URL.
    scannedSetAvailable.set(
      set,
      fetch(assetUrl(`${SCANNED_BASE}/${set}/albedo.webp`))
        .then((response) => response.ok && (response.headers.get('content-type') || '').startsWith('image/'))
        .catch(() => false),
    )
  }
  return scannedSetAvailable.get(set)
}

async function upgradeToScannedStone(material, set, repeat, normalScale) {
  const [repeatU, repeatV] = scannedRepeat(repeat)
  if (!(await isScannedStoneInstalled(set))) return

  const textures = await Promise.all(
    SCANNED_SLOTS.map((slot) => loadOptionalTexture(assetUrl(`${SCANNED_BASE}/${set}/${slot.file}`))),
  )

  // Albedo and normal are the two that carry the realism. Without both, the
  // generated set is the better material and is left alone.
  if (!textures[0] || !textures[1]) return

  textures.forEach((texture, index) => {
    if (!texture) return
    const { key: rawSlot, colorSpace } = SCANNED_SLOTS[index]
    // The ORM texture is assigned to two material slots; everything else maps
    // one-to-one.
    const slots = rawSlot === 'ormMap' ? ['aoMap', 'roughnessMap'] : [rawSlot]
    const slot = slots[0]
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatU, repeatV)
    // Colour data is sRGB; normal, roughness and occlusion are measurements
    // and must stay linear or the lighting maths is fed gamma-encoded values.
    texture.colorSpace = colorSpace ?? THREE.NoColorSpace
    texture.anisotropy = 8
    // three reads aoMap from uv1 by default; none of this room's geometry
    // carries a second UV set, so point it at uv0.
    if (slot === 'aoMap') texture.channel = 0
    slots.forEach((target) => {
      // Only dispose a generated map being replaced — never the shared ORM
      // texture itself, which would tear down the second slot's own reference.
      if (material[target] && material[target] !== texture) material[target].dispose()
      material[target] = texture
    })
  })

  // The tint is left exactly as the caller set it. A scanned albedo is a real
  // measured reflectance — bright cream stone — where the generated one was
  // artificially dark, so the caller picks a tint for the scan rather than
  // this function guessing a correction on top of it.
  /**
   * 1.0 -> 0.7.
   *
   * `aoMap` attenuates ambient and environment light only, so it acts almost
   * entirely on surfaces the sun does NOT reach — precisely the surfaces the
   * brief says must keep their material information. Measured off the files,
   * the columns' occlusion channel runs 7-255: at full strength its deepest
   * pores receive essentially none of the indirect light, so shaded stone
   * collapsed to a featureless dark surface exactly where the scan had the
   * most to say.
   *
   * Backing it off keeps the contact darkening that seats the geometry while
   * leaving the crevices enough light to read as stone. This is a correction
   * for the room now having real indirect illumination to occlude — under the
   * previous near-black interior there was almost nothing for the AO to take
   * away, so 1.0 cost nothing and now costs the shadows their texture.
   */
  material.aoMapIntensity = 0.7
  // Scanned normals are calibrated; the generated ones needed exaggerating.
  material.normalScale.set(Math.min(normalScale[0], 1), Math.min(normalScale[1], 1))
  material.needsUpdate = true
}

/**
 * How a surface's own repeat maps onto the scanned tile.
 *
 * A column's U axis wraps the shaft, so its repeat must stay a whole number or
 * the texture jumps at the seam — which also means its V cannot be rescaled
 * independently without stretching the tile. Columns therefore pass a repeat
 * already in square-aspect terms and are used verbatim; flat surfaces get the
 * scanned world scale applied.
 */
function scannedRepeat(repeat) {
  const scale = TILE_SIZE / SCANNED_TILE_SIZE
  const wrapsShaft = repeat[0] === 1
  return wrapsShaft ? [1, repeat[1]] : [repeat[0] * scale, repeat[1] * scale]
}

/**
 * A material built straight from the scan, with no generated stand-in at any
 * point.
 *
 * This is the path taken whenever the loading gate's preflight has already put
 * the set in memory, which is every normal load. The generated maps it skips
 * were only ever visible in the window between the scene mounting and the
 * scans arriving — a window the gate now closes by holding the whole canvas
 * out of sight until both have happened. Building them was measured at ~246ms
 * of the startup budget, spent entirely on textures that were then thrown
 * away.
 *
 * The tint is left exactly as the caller set it, the normal scale is clamped
 * the same way, and `aoMapIntensity` carries the same 0.7 — this produces the
 * identical material the upgrade path produced, it simply never builds the
 * other one first.
 */
function createScannedStoneMaterial(tintColor, repeat, normalScale, set) {
  const [repeatU, repeatV] = scannedRepeat(repeat)
  const maps = cloneScannedMaps(set, repeatU, repeatV)

  const material = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    // Scanned normals are calibrated; the generated ones needed exaggerating.
    normalScale: new THREE.Vector2(Math.min(normalScale[0], 1), Math.min(normalScale[1], 1)),
    roughnessMap: maps.ormMap,
    aoMap: maps.ormMap,
    color: tintColor,
    metalness: 0,
  })
  // See `upgradeToScannedStone` for why this is 0.7 rather than 1.
  material.aoMapIntensity = 0.7
  return material
}

export function createStoneWallMaterial(tintColor, repeat = [6, 3], normalScale = [1.4, 1.4], options = {}) {
  const { bond = 'ashlar', erosion = 0, stain = 0, scanned = false } = options

  /*
   * Direct path: the scan is already decoded and resident, so build from it
   * and skip the generated maps entirely.
   *
   * `scannedStoneReady` is the preflight's own signal — not a second
   * availability test. It is populated by `preloadScannedStone`, which
   * `criticalAssets.js` runs before the scene is allowed to mount, so there is
   * no extra request, no extra decode and no new waterfall here: this is a
   * synchronous map lookup.
   *
   * Everything below this line is the resilience path, and is still reached
   * whenever the scan is genuinely unavailable — a missing or corrupt file, a
   * failed decode, or the preflight's own 20s timeout firing before the set
   * arrived. In those cases the room is built procedurally and upgraded in
   * place exactly as before, so a missing texture can never leave the scene
   * broken.
   */
  if (scanned && scannedStoneReady(scanned)) {
    return createScannedStoneMaterial(tintColor, repeat, normalScale, scanned)
  }

  const height = buildHeightField(bond, erosion)
  const map = buildAlbedoTexture(height, stain)
  const normalMap = buildNormalTexture(height)
  const roughnessMap = buildRoughnessTexture()

  ;[map, normalMap, roughnessMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeat[0], repeat[1])
    texture.needsUpdate = true
  })

  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(normalScale[0], normalScale[1]),
    roughnessMap,
    color: tintColor,
    metalness: 0,
  })

  // Opt-in per surface, and each surface names its own set — `scanned` is a
  // folder under `/textures`, not a flag. Sharing one scan across the room
  // does not work: a cliff face reads as quarried stone on a column and as
  // timber decking tiled flat across a floor. Each surface gets stone that
  // matches what it physically is, or keeps the generated map.
  //
  // Fire and forget — no await: the caller needs a material this frame, and
  // the swap is a no-op when nothing is installed.
  // Registered with `assetReadiness` so the loading gate can hold the scene
  // out of sight until the swap has happened, rather than letting it land
  // on whatever frame the decode finishes. Still fire and forget from this
  // function's point of view — nothing here awaits it.
  if (scanned) trackAssetUpgrade(upgradeToScannedStone(material, scanned, repeat, normalScale))

  return material
}

/**
 * Every file a scanned set is made of, including the availability probe's own
 * URL (which is `albedo.webp`, so the probe and the map share one request).
 *
 * Exported so `criticalAssets.js` can warm exactly these URLs rather than
 * keeping a second, hand-copied list that would drift the first time a slot
 * is added or a format changes.
 */
export function scannedStoneUrls(set) {
  return SCANNED_SLOTS.map(({ file }) => `${SCANNED_BASE}/${set}/${file}`)
}

/** One stone block ≈ `TILE_SIZE` world units — see the module doc comment. */
const TILE_SIZE = 1.4

/** Derives a `repeat` tuple from a wall segment's actual physical [width, height]. */
export function stoneRepeatForSize(width, height) {
  return [width / TILE_SIZE, height / TILE_SIZE]
}
