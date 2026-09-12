import * as THREE from 'three'
import { trackAssetUpgrade } from '../loading/assetReadiness.js'
import { planPoint, wallDeviation } from './galleryShellGeometry.js'

/**
 * MGRT MEDIA, cut into the back wall of the gallery.
 *
 * **This is a surface, not a title card.** The one rule the reveal has to
 * obey is that the light finds the wordmark — the wordmark must never
 * announce itself. So there is no opacity ramp here, no scale, no glow and
 * no timeline of its own: the inscription exists from the first frame at
 * full opacity, and the only reason it is invisible at the start of the
 * sequence is the same reason the columns and the floor are invisible at
 * the start of the sequence. `VolumetricLightingRig`'s ignition ramp owns
 * it, by owning the room it is standing in.
 *
 * That only works if the letters are *physically* the kind of thing that
 * needs a light to be seen, which is what the three maps below are for:
 *
 *  - `normalMap` — the carving. A bevelled groove has no contrast at all
 *    under a flat ambient term, because every facet of it faces a source
 *    of identical value; it only resolves once something in the room is
 *    directional. At ignition 0 the room is almost entirely
 *    `hemisphere.darkIntensity`, so the relief reads as nothing. As
 *    `setIgnition` brings the spot, key and fill up, N·L starts to vary
 *    across each bevel and the letterforms come out of the wall. That
 *    transition is not animated anywhere — it is the arithmetic of a
 *    carved surface under a light that is being turned up.
 *
 *  - `metalnessMap` — a bronze inlay in the groove, stone everywhere else.
 *    Metal carries no diffuse response whatsoever, so in the flat opening
 *    state the inlay sits at essentially the wall's own value and adds no
 *    silhouette. Once there is a real source to reflect, it is the
 *    brightest thing on the wall. This is what carries legibility at the
 *    top of the ramp, where the brief asks for it.
 *
 *  - `roughnessMap` — packed into the same texture (three reads roughness
 *    from `.g` and metalness from `.b`, so one image serves both).
 *
 * The albedo stays within a few percent of the surrounding stone. A darker
 * one would make the wordmark legible as a *stain* in the dark state,
 * which is the failure this whole approach exists to avoid.
 */

/** The inscription's own patch of wall. */
export const WALL_INSCRIPTION = {
  /** Angle from +Z. π is the back wall's apex — see `planPoint`. */
  centerTheta: Math.PI,
  /**
   * Height of the band's centre.
   *
   * The opening orbit's eyeline crosses this wall at roughly y = 2.4
   * (sampled off `sampleCameraPath`, not guessed), so sitting a little
   * above that reads as architecture placed on a wall rather than as a
   * caption laid across the middle of the frame. It also clears the wall
   * skirt's debris entirely.
   */
  centerY: 3.6,
  /**
   * Band size in world units.
   *
   * These are occlusion numbers, not composition ones. This wall is read
   * through the column ring, and the camera orbits only 3.5 units outside
   * it, so ring columns pass very close to the lens and each one blots out
   * several degrees of the wall behind it. Laid out as a single line the
   * wordmark never once read as its own name at any point in the orbit —
   * every frame showed "GRT MEDIA", "MGRT MED" or worse, and widening it
   * to 15.5 only traded which end was lost.
   *
   * Searched width and offset against `sampleCameraPath` and the real ring
   * positions, scoring the WORST single glyph rather than the average,
   * since a wordmark is only as legible as its least visible letter. Two
   * stacked lines at 8.0 across is the best the room allows: at the moment
   * this wall is best framed every letter is at least half clear, against a
   * ceiling of 40% for any single-line layout at any width.
   */
  width: 8.0,
  height: 2.6,
  /**
   * Slide along the wall from the apex, in world units. Same search as the
   * width above — this is where the ring's gaps happen to fall relative to
   * the camera as the orbit crosses this wall.
   */
  offsetAlongWall: 1.5,
  /**
   * How far the inlay stands proud of the shell surface. Small enough to
   * be flush at any viewing distance in this sequence, large enough to
   * clear the wall's own low-frequency wander plus the depth-buffer
   * precision at 24 units.
   */
  standoff: 0.012,
}

/**
 * Where the wordmark sits in the world, and which way it faces.
 *
 * Solved from the same spec the geometry is built from, so the camera that
 * frames it and the mesh itself can never disagree. `cameraPath.js` reads both
 * to place the hero shot: deriving the framing from the wordmark means a
 * re-layout of the inscription moves the camera with it rather than silently
 * mis-framing.
 *
 * The centre is offset along the wall by `offsetAlongWall`, so it is NOT the
 * shell's apex — it has to be marched along the plan curve exactly the way the
 * geometry marches it.
 */
function solveInscriptionPlacement(spec = WALL_INSCRIPTION) {
  const theta = (() => {
    // Same arc march as the geometry, for the band's centre only.
    const step = spec.offsetAlongWall < 0 ? -0.0004 : 0.0004
    let t = spec.centerTheta
    let previous = planPoint(t)
    let arc = 0
    while (Math.abs(arc) < Math.abs(spec.offsetAlongWall)) {
      t += step
      const p = planPoint(t)
      arc += Math.sign(step) * Math.hypot(p.x - previous.x, p.z - previous.z)
      previous = p
    }
    return t
  })()

  const p = planPoint(theta)
  const radius = Math.hypot(p.x, p.z) || 1
  const deviation = wallDeviation(theta, spec.centerY) - spec.standoff
  const center = [
    p.x + (p.x / radius) * deviation,
    spec.centerY,
    p.z + (p.z / radius) * deviation,
  ]
  // Inward normal: the wall faces the room, so it points back along its own
  // plan radius toward the centre line.
  const normal = [-p.x / radius, 0, -p.z / radius]
  return { center, normal }
}

const placement = solveInscriptionPlacement()

/** World position of the wordmark's centre. */
export const WALL_INSCRIPTION_CENTER = placement.center
/** Inward-facing surface normal at that point, horizontal. */
export const WALL_INSCRIPTION_NORMAL = placement.normal

const SEGMENTS_ACROSS = 64
const SEGMENTS_DOWN = 6

/**
 * A strip of wall, expressed in the shell's own parameters.
 *
 * Built from `planPoint` and `wallDeviation` rather than as a plane placed
 * near the wall, for the same reason `contactDebris` follows `planPoint`:
 * the shell bows by up to ~0.15 units, so a flat quad would be buried at
 * one end and floating at the other.
 */
export function buildWallInscriptionGeometry(spec = WALL_INSCRIPTION) {
  const { centerTheta, centerY, width, height, standoff, offsetAlongWall } = spec

  // Arc length is what has to be even across the band — stepping theta
  // evenly would letter-space the wordmark wider wherever the plan curve
  // is turning. Marched rather than derived, since the superellipse has no
  // closed-form arc length.
  const thetaForArc = buildArcTable(centerTheta, width / 2 + Math.abs(offsetAlongWall))

  const positions = []
  const uvs = []
  const indices = []

  for (let iy = 0; iy <= SEGMENTS_DOWN; iy += 1) {
    const v = iy / SEGMENTS_DOWN
    const y = centerY + (0.5 - v) * height

    for (let ix = 0; ix <= SEGMENTS_ACROSS; ix += 1) {
      const u = ix / SEGMENTS_ACROSS
      const theta = thetaForArc((u - 0.5) * width + offsetAlongWall)
      const p = planPoint(theta)
      const radius = Math.hypot(p.x, p.z) || 1
      // Inward along the wall's own radius: out to the true surface via
      // its deviation, then back off it by the standoff.
      const offset = wallDeviation(theta, y) - standoff
      positions.push(p.x + (p.x / radius) * offset, y, p.z + (p.z / radius) * offset)
      // U runs against theta: theta increases clockwise as seen from
      // inside the room, and this surface is read from inside.
      uvs.push(1 - u, 1 - v)
    }
  }

  const stride = SEGMENTS_ACROSS + 1
  for (let iy = 0; iy < SEGMENTS_DOWN; iy += 1) {
    for (let ix = 0; ix < SEGMENTS_ACROSS; ix += 1) {
      const a = iy * stride + ix
      const b = a + 1
      const c = (iy + 1) * stride + ix
      const d = c + 1
      // Inward-facing, matching the shell it sits on — the back wall's own
      // normal points into the room, at +Z.
      indices.push(a, b, c, b, d, c)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** Maps an arc-length offset either side of `centerTheta` back to a theta. */
function buildArcTable(centerTheta, halfWidth) {
  const step = 0.0004
  const thetas = [centerTheta]
  const arcs = [0]

  let theta = centerTheta
  let prev = planPoint(theta)
  let arc = 0
  while (arc < halfWidth * 1.2) {
    theta += step
    const p = planPoint(theta)
    arc += Math.hypot(p.x - prev.x, p.z - prev.z)
    thetas.push(theta)
    arcs.push(arc)
    prev = p
  }

  return (target) => {
    const sign = target < 0 ? -1 : 1
    const want = Math.abs(target)
    let i = 1
    while (i < arcs.length - 1 && arcs[i] < want) i += 1
    const span = arcs[i] - arcs[i - 1] || 1
    const f = (want - arcs[i - 1]) / span
    const delta = THREE.MathUtils.lerp(thetas[i - 1], thetas[i], f) - centerTheta
    return centerTheta + sign * delta
  }
}

/* ------------------------------------------------------------------ */
/* The inlay's maps                                                     */
/* ------------------------------------------------------------------ */

/**
 * The wordmark. `docs/experience-design.md` §4: "MGRT MEDIA".
 *
 * Stacked, because stacking is what makes it legible here — see
 * `WALL_INSCRIPTION.width`. `fill` is the fraction of the band each line
 * spans, and `tracking` is its letter-spacing in ems; the smaller line is
 * tracked wider, which is the ordinary way a subordinate line is set on an
 * architectural inscription and keeps both lines optically the same weight.
 */
const LINES = [
  { text: 'MGRT', fill: 0.9, tracking: 0.22, baseline: 0.33 },
  { text: 'MEDIA', fill: 0.74, tracking: 0.36, baseline: 0.77 },
]
/** Cormorant, as loaded in `index.html` for the site mark — one mark at two scales. */
const FONT_STACK = "'Cormorant', Georgia, serif"
const FONT_WEIGHT = 500

const MAP_WIDTH = 2048

/**
 * Width of the carved bevel, in texels of a 2048-wide map.
 *
 * This is the most important number here. Too narrow and the chamfer is a
 * hairline that disappears at the ~24 units the opening orbit views this
 * wall from; too wide and the letters read as soft embossed plastic rather
 * than as metal set into cut stone.
 */
const BEVEL_TEXELS = 7

/** How steeply the chamfer turns away from the wall. */
const RELIEF_STRENGTH = 3.2

/**
 * Scanned brass for the lettering.
 *
 * The inlay used to be a flat tint — one colour, one roughness — which is
 * exactly why it read as "a metal" rather than as brass: a real alloy surface
 * is never uniform, and it is the variation in its polish, not its hue, that
 * makes the eye accept it. `brass_pan_01` supplies both.
 *
 * Only two of the set's five maps are here, and the omissions are deliberate:
 *
 *  - the **normal** map is not used, because that slot is already carrying the
 *    chamfer, and the chamfer is what makes the letters legible at all — it
 *    is the whole reveal mechanism (see the module note). Surface grain would
 *    be a poor trade for the letterforms;
 *  - **AO** does nothing worth its download here. It attenuates ambient only,
 *    and these are centimetre-scale letters with no cavities to occlude;
 *  - **metalness** is a constant 1 instead of a map. The source map varies
 *    because the pan it was scanned from has non-metal parts; an inlay is
 *    brass everywhere, so the map would be wrong as well as redundant.
 *
 * Downscaled from the 2K source — the wordmark is a small part of the frame
 * even at the hero, and 2K of pan for two lines of type is not a trade this
 * project makes. 248KB for the pair.
 */
const BRASS_BASE = '/textures/brass'

/**
 * Which PART of the scan to use, as a UV crop.
 *
 * This is a photograph of a whole pan, not a brass swatch — one large bowl,
 * and a dark red handle off to one side. Tiling the sheet was the obvious
 * first move and it was wrong: every repeat dragged the handle's maroon in
 * with it, and the lettering came out mottled red like polished stone rather
 * than metal.
 *
 * So the atlas is cropped to the bowl's interior instead of repeated. That
 * region is continuous brass — patina, wear and a slow shift in polish, with
 * none of the object's own colour breaks. Stretched once across the band it
 * gives the letters low-frequency variation, which is the whole reason for
 * using a scan; tiling it would only reintroduce the seam it was cropped to
 * avoid, since a crop out of a photograph does not wrap.
 */
const BRASS_OFFSET = [0.08, 0.08]
const BRASS_REPEAT = [0.42, 0.38]

/** The two files the inlay is made of — see `criticalAssets.js`. */
export const BRASS_URLS = [`${BRASS_BASE}/albedo.jpg`, `${BRASS_BASE}/roughness.jpg`]

/**
 * Fire-and-forget, like the scanned stone: nothing suspends on it. Each load
 * is registered with `assetReadiness` so the loading gate can wait for the
 * swap instead of letting the letters change material in full view.
 */
function loadBrassMaps(material) {
  const loader = new THREE.TextureLoader()
  const apply = (slot, file, colorSpace) => {
    trackAssetUpgrade(new Promise((resolve) => {
    loader.load(
      `${BRASS_BASE}/${file}`,
      (texture) => {
        // Clamped, not repeating: this is a crop, and wrapping it would fold
        // the far side of the pan back into the letters.
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.offset.set(BRASS_OFFSET[0], BRASS_OFFSET[1])
        texture.repeat.set(BRASS_REPEAT[0], BRASS_REPEAT[1])
        texture.colorSpace = colorSpace ?? THREE.NoColorSpace
        texture.anisotropy = 8
        material[slot] = texture
        material.needsUpdate = true
        resolve()
      },
      undefined,
      // A missing file leaves the flat tint in place rather than a black
      // inlay — and resolves, so a missing texture cannot stall the gate.
      () => resolve(),
    )
    }))
  }
  apply('map', 'albedo.jpg', THREE.SRGBColorSpace)
  apply('roughnessMap', 'roughness.jpg')
}

/** Where the cutout's edge falls within that chamfer. */
const ALPHA_TEST = 0.55

function drawWordmark(ctx, width, height) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'

  for (const line of LINES) {
    // Letters are placed one at a time rather than as a single `fillText`
    // with `letterSpacing`: that property is not universally available, and
    // the tracking here is not decoration — it is what makes a display serif
    // read as a mark rather than as a word.
    const measure = (size) => {
      ctx.font = `${FONT_WEIGHT} ${size}px ${FONT_STACK}`
      const gap = size * line.tracking
      let total = 0
      for (const ch of line.text) total += ctx.measureText(ch).width + gap
      return total - gap
    }

    // One measurement, then scale — text advance is linear in font size.
    const probe = 200
    const fontSize = (probe * width * line.fill) / measure(probe)
    const advance = measure(fontSize)

    ctx.font = `${FONT_WEIGHT} ${fontSize}px ${FONT_STACK}`
    const gap = fontSize * line.tracking
    let x = (width - advance) / 2
    for (const ch of line.text) {
      ctx.fillText(ch, x, height * line.baseline)
      x += ctx.measureText(ch).width + gap
    }
  }
}

/** Separable box blur, two passes — cheap, and close enough to a chamfer. */
function blur(source, width, height, radius) {
  let input = source
  let output = new Float32Array(source.length)
  const scratch = new Float32Array(source.length)

  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0
        let n = 0
        for (let k = -radius; k <= radius; k += 1) {
          const sx = x + k
          if (sx < 0 || sx >= width) continue
          sum += input[y * width + sx]
          n += 1
        }
        output[y * width + x] = sum / n
      }
    }
    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        let sum = 0
        let n = 0
        for (let k = -radius; k <= radius; k += 1) {
          const sy = y + k
          if (sy < 0 || sy >= height) continue
          sum += output[sy * width + x]
          n += 1
        }
        scratch[y * width + x] = sum / n
      }
    }
    input = scratch.slice()
  }
  return input
}

/**
 * Renders the wordmark once and derives the two maps from it: the cutout
 * that decides where there is metal at all, and the chamfer that gives its
 * edge something to catch the light with.
 *
 * Both are generated in the browser from a font the document already
 * carries, so the wordmark costs no download — which is the only reason it
 * can afford to be a 2048-wide map.
 */
function paintMaps(cutoutCanvas, normalCanvas) {
  const { width, height } = cutoutCanvas
  const scratch = document.createElement('canvas')
  scratch.width = width
  scratch.height = height
  const sctx = scratch.getContext('2d', { willReadFrequently: true })
  drawWordmark(sctx, width, height)

  const drawn = sctx.getImageData(0, 0, width, height).data
  const coverage = new Float32Array(width * height)
  for (let i = 0; i < coverage.length; i += 1) coverage[i] = drawn[i * 4 + 3] / 255

  const bevelRadius = Math.max(1, Math.round((BEVEL_TEXELS * width) / MAP_WIDTH))
  const relief = blur(coverage, width, height, bevelRadius)

  const cutoutCtx = cutoutCanvas.getContext('2d')
  const normalCtx = normalCanvas.getContext('2d')
  const cutout = cutoutCtx.createImageData(width, height)
  const normal = normalCtx.createImageData(width, height)

  const at = (x, y) =>
    relief[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const h = relief[y * width + x]

      // The cutout is the CHAMFERED coverage, not the crisp glyph: thresholding
      // the blurred field at `ALPHA_TEST` puts the mesh's edge partway up the
      // chamfer, so the visible silhouette and the shaded bevel are the same
      // feature rather than two that nearly line up.
      const a = Math.round(h * 255)
      cutout.data[i] = 255
      cutout.data[i + 1] = 255
      cutout.data[i + 2] = 255
      cutout.data[i + 3] = a

      // Tangent-space normal from the gradient of that field. `flipY` on the
      // texture already inverts the canvas's downward Y once, which leaves
      // the green channel pointing up — the convention three expects.
      const dx = (at(x + 1, y) - at(x - 1, y)) * RELIEF_STRENGTH
      const dy = (at(x, y + 1) - at(x, y - 1)) * RELIEF_STRENGTH
      const len = Math.hypot(dx, dy, 1)
      normal.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      normal.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      normal.data[i + 2] = (1 / len) * 0.5 * 255 + 127.5
      normal.data[i + 3] = 255
    }
  }

  cutoutCtx.putImageData(cutout, 0, 0)
  normalCtx.putImageData(normal, 0, 0)
}

/**
 * The inlay material.
 *
 * **It is a cutout, not a panel.** An earlier version drew the letters onto
 * a stone-coloured plate covering the whole band; on the wall it read as a
 * lit rectangle hung in the room, because a flat generated albedo has none
 * of the scanned texture that makes the shell around it as dark as it is.
 * Discarding everything outside the letterforms removes the problem at the
 * source: there is no plate, so the surface between the letters IS the
 * wall, at the wall's own tint, texture and darkness.
 *
 * **Why metal.** On this wall the only source that rises with ignition is
 * `key` — the spot's cone never reaches the back of the hall, and the
 * hemisphere term actually falls as the room ignites. So the reveal has to
 * be carried by something that responds to a *directional* source and to
 * nothing else, and metal is exactly that: it has no diffuse response at
 * all, so at ignition 0, with `key` multiplied to zero, there is nothing
 * for it to return and the letters are not there. As `key` comes up, the
 * chamfer's specular does, and the wordmark resolves out of a wall that is
 * meanwhile getting darker around it.
 *
 * Note what is absent: no emissive, no transparency, no custom shader, no
 * uniform for anything to animate. It is an ordinary standard material, so
 * every light in `volumetricLighting.js` acts on it exactly as it acts on
 * the stone behind it — which is the only way this reveal can be the room's
 * reveal instead of a second one running alongside it.
 */
export function createWallInscriptionMaterial(spec = WALL_INSCRIPTION) {
  const width = MAP_WIDTH
  const height = Math.round((MAP_WIDTH * spec.height) / spec.width)

  const make = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
  const cutoutCanvas = make()
  const normalCanvas = make()

  const alphaMap = new THREE.CanvasTexture(cutoutCanvas)
  const normalMap = new THREE.CanvasTexture(normalCanvas)
  for (const texture of [alphaMap, normalMap]) {
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
  }

  const repaint = () => {
    paintMaps(cutoutCanvas, normalCanvas)
    alphaMap.needsUpdate = true
    normalMap.needsUpdate = true
  }

  repaint()
  // Cormorant arrives over the network. Painting immediately means a
  // fallback serif is what lands on the wall on a cold load; repainting when
  // the real face resolves corrects it, and both happen long before the
  // ignition ramp makes any of it visible.
  document.fonts
    ?.load(`${FONT_WEIGHT} 200px 'Cormorant'`)
    .then(repaint)
    .catch(() => {})

  const material = new THREE.MeshStandardMaterial({
    // A tint over the scan rather than the brass itself now — held slightly
    // under white so the lettering keeps the room's restraint at the top of
    // the ignition ramp instead of flaring.
    color: new THREE.Color('#d8cdb8'),
    metalness: 1,
    // The scan drives this once it lands; until then this is the fallback, and
    // it stays low enough that `key` reads as a defined highlight along each
    // chamfer rather than a wash.
    roughness: 0.28,
    normalMap,
    normalScale: new THREE.Vector2(1, 1),
    alphaMap,
    alphaTest: ALPHA_TEST,
  })

  loadBrassMaps(material)
  return material
}
