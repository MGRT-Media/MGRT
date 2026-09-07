import * as THREE from 'three'

/**
 * The gallery shell — one continuous swept surface that replaces the five
 * flat wall planes and their hard 90-degree corners with a curved
 * enclosure rising into a vault.
 *
 * **Why one geometry rather than curved wall pieces.** The boxiness the
 * shell had was not only that the walls were flat; it was that they met
 * at corners and stopped dead at the top, so the room read as five
 * rectangles rather than a space. A single parametric surface has no
 * corners to hide and no open top — the plan curve, the springing and the
 * vault are the same sheet of geometry, which is what makes the room feel
 * enclosed by architecture instead of contained by a box.
 *
 * **The plan is a superellipse**, not a circle or a rectangle:
 * `|x/A|^n + |z/B|^n = 1`. At `n = 2` that is an ellipse (fully round, the
 * hall would read as a tube); as `n` rises it approaches a rectangle. The
 * exponent below keeps the long sides reading as walls while every corner
 * rolls through a continuous curve — the hall's approved 20 x 38 footprint
 * is preserved exactly (A and B are its half-extents), so everything
 * derived from those dimensions stays valid.
 *
 * **Two openings are cut from the sheet**, both by skipping cells in the
 * parametric grid rather than by boolean geometry:
 *
 * - The **front mouth**, so the Campaigns pull-back can leave the room.
 *   The camera exits at a bearing of 11.1 degrees from +Z (measured off
 *   the real path, not assumed); `OPENING_HALF_ANGLE` is set far wider so
 *   the frame never catches the opening's edge on the way out. It is an
 *   arch rather than a full-height gap — see `MOUTH_HEIGHT`.
 * - The **breach**, the fractured opening the key light streams through.
 *   It keeps its position and its irregular outline, but now curves with
 *   the wall it sits in instead of being a flat panel let into it.
 */

// The approved hall footprint — half-extents. Unchanged, deliberately:
// the light's position, the breach, the monitor anchor and every camera
// keyframe are derived from these, so the shell curves *within* the
// existing envelope rather than moving it.
const A = 10
const B = 19

// Plan exponent. 2 = ellipse, large = rectangle. 3.2 keeps the long side
// walls reading as walls (a gallery, not a rotunda) while rolling every
// corner into a continuous sweep.
const PLAN_EXPONENT = 3.2

// Where the wall stops rising vertically and starts turning into vault.
// Set above the breach's top edge (6.3 + 1.85 = 8.15) so the opening sits
// entirely in the vertical wall — a fractured hole climbing into the
// curve of a vault would read as damage to the roof, not a window.
const SPRINGING_HEIGHT = 8.6
const CROWN_HEIGHT = 12.4

// The vault tucks in hard across the hall's width and only gently along
// its length, which is what makes it read as a barrel running the length
// of the gallery rather than a dome sat on top of it.
const VAULT_Z_TUCK = 0.35

// The crown keeps a narrow flat ridge instead of tapering to nothing.
// Letting the width scale reach exactly 0 collapses both sides of the
// vault onto the same line, which produces a seam of degenerate,
// zero-area triangles along the ridge — and a seam is a hole: a ray cast
// straight up from the floor at x = 0 passes through it. Verified, not
// assumed; a roof-closure test found exactly that column of interior
// points uncovered and nothing else. A real barrel vault has a ridge
// anyway, so this is the correct form as well as the robust one.
const VAULT_RIDGE_SCALE = 0.05

// Half-width of the front mouth, in degrees off +Z. The camera leaves at
// 11.1 degrees; this is set well past that so no edge enters frame.
const OPENING_HALF_ANGLE = THREE.MathUtils.degToRad(42)

// The mouth is an ARCH, not a full-height gap, and that is structural
// rather than decorative. Cutting it full height would carry the opening
// up through the vault and leave a hole in the roof directly above it —
// which is the same defect `campaigns/RoomCeiling.jsx` existed to patch:
// during the Campaigns pull-back the camera retreats until the room's
// upper boundary rises into frame, and an open roof there stops the room
// reading as an interior. Closing the shell above this height means the
// vault is continuous all the way round, so that component is no longer
// needed at all and has been removed.
//
// 7.0 clears the camera by a wide margin — the path never rises above
// 1.80 anywhere (measured against the real `sampleCameraPath`, not
// assumed), so the arch is far outside the frustum on the way through.
const MOUTH_HEIGHT = 7.0

// How far the opening tapers in as it approaches the arch's crown. Without
// this the mouth would be a rectangle with a lid; easing the half-angle
// down over the top third turns it into a genuine arched opening.
const MOUTH_SHOULDER = 0.66

const RADIAL_SEGMENTS = 260
const HEIGHT_SEGMENTS = 72

/**
 * How far the wall may wander off its ideal sweep, in world units.
 *
 * A superellipse swept perfectly is still a machined surface: every
 * horizontal section is the same curve, so raking light produces an even,
 * mathematically smooth gradient, and the eye reads "extruded shape". Real
 * walls of this age are out of true — they bow, lean and settle by a few
 * centimetres over their height. This is small enough to be invisible as
 * shape and large enough to break that gradient, which is where the
 * machined read actually lives.
 *
 * It is deliberately a low-frequency field, not surface noise: fine
 * roughness is the stone material's job, and doubling it in geometry only
 * produces the busy, sparkly result the brief rules out.
 */
const WALL_DEVIATION = 0.16

/** Deterministic hash, matching `stoneWallMaterial.js`'s approach. */
function hash2D(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return value - Math.floor(value)
}

/**
 * A smooth field that WRAPS in theta, so the wall closes on itself
 * without a seam where the sweep comes back round.
 */
function wallWobble(theta, v) {
  const turns = 3
  const a = Math.sin(theta * turns + v * 2.1 + 0.7)
  const b = Math.sin(theta * (turns * 2) - v * 1.3 + 2.4) * 0.5
  const c = Math.sin(theta * (turns * 3) + v * 3.7 - 1.1) * 0.25
  // A slow vertical lean on top, so the surface is not merely rippled but
  // genuinely out of plumb in places.
  const lean = Math.sin(theta * 2 + 1.9) * (v - 0.35) * 0.8
  return (a + b + c) * 0.5 + lean
}

// Fraction of the vertical parameter spent below the springing.
const SPLIT = 0.62

/**
 * Superellipse plan radius in the XZ plane, at angle `theta` from +Z.
 *
 * Exported so the floor/wall contact debris can follow the exact same
 * footprint — see `contactDebris.js`. A skirt built on an approximation of
 * this curve would drift away from the wall it is supposed to be joining,
 * which is the one thing it must not do.
 */
export function planPoint(theta) {
  const sin = Math.sin(theta)
  const cos = Math.cos(theta)
  const denom = Math.pow(
    Math.pow(Math.abs(sin) / A, PLAN_EXPONENT) + Math.pow(Math.abs(cos) / B, PLAN_EXPONENT),
    -1 / PLAN_EXPONENT,
  )
  return { x: denom * sin, z: denom * cos }
}

/** Deterministic hash — matches the approach used in `stoneWallMaterial.js`. */
function hash1D(n) {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

/**
 * The breach's irregular edge, as a radius multiplier around its own
 * centre. Same construction as the flat panel it replaces: broad lobes
 * from two low-frequency harmonics (reading as fracture planes) plus fine
 * jitter, rather than pure noise, which reads as a spiky star.
 */
function fractureRadius(angle) {
  const lobes = 1 + 0.16 * Math.sin(3 * angle + 0.6) + 0.12 * Math.sin(5 * angle + 2.1)
  const jitter = 1 + (hash1D(Math.floor(angle * 6) * 3.7 + 11) - 0.5) * 0.22
  return lobes * jitter
}

export const GALLERY_SHELL = {
  springingHeight: SPRINGING_HEIGHT,
  crownHeight: CROWN_HEIGHT,
  openingHalfAngle: OPENING_HALF_ANGLE,
  /** Breach centre, matching `volumetricLighting.js`'s spot position. */
  breach: { centerZ: -3, centerY: 6.3, radiusArc: 1.15, radiusY: 1.85 },
}

/**
 * Builds the shell. Vertices are laid out on a (theta, v) grid; cells are
 * emitted as triangles only where they are not inside one of the two
 * openings, so the holes are genuine gaps in the surface rather than
 * geometry hidden behind something.
 *
 * Winding is chosen so the surface faces INWARD — the camera lives inside
 * this room, and a shell facing outward would light and shade from the
 * wrong side.
 */
export function buildGalleryShellGeometry() {
  const positions = []
  const uvs = []
  const grid = []

  // Breach centre expressed as an angle, so it lands on the curved wall
  // exactly where the flat panel used to sit on the straight one.
  const breachTheta = Math.atan2(A, GALLERY_SHELL.breach.centerZ) // +X side
  const breachCentre = planPoint(breachTheta)
  const breachArcScale = Math.hypot(breachCentre.x, breachCentre.z)

  for (let iy = 0; iy <= HEIGHT_SEGMENTS; iy += 1) {
    const v = iy / HEIGHT_SEGMENTS
    let y
    let xScale
    let zScale

    if (v <= SPLIT) {
      // Vertical wall.
      y = (v / SPLIT) * SPRINGING_HEIGHT
      xScale = 1
      zScale = 1
    } else {
      // Vault: a quarter-sine sweep from the springing to the crown.
      const w = (v - SPLIT) / (1 - SPLIT)
      const arc = Math.sin(w * Math.PI * 0.5)
      const tuck = Math.cos(w * Math.PI * 0.5)
      y = SPRINGING_HEIGHT + (CROWN_HEIGHT - SPRINGING_HEIGHT) * arc
      xScale = VAULT_RIDGE_SCALE + (1 - VAULT_RIDGE_SCALE) * tuck
      zScale = 1 - VAULT_Z_TUCK * (1 - tuck)
    }

    const row = []
    for (let ix = 0; ix <= RADIAL_SEGMENTS; ix += 1) {
      const u = ix / RADIAL_SEGMENTS
      const theta = -Math.PI + u * Math.PI * 2
      const p = planPoint(theta)
      // Push the section in or out along its own radius, so the wall bows
      // rather than shearing sideways.
      const radius = Math.hypot(p.x, p.z) || 1
      const deviation = wallWobble(theta, v) * WALL_DEVIATION
      const nx = (p.x / radius) * deviation
      const nz = (p.z / radius) * deviation
      row.push(positions.length / 3)
      positions.push((p.x + nx) * xScale, y, (p.z + nz) * zScale)
      // U follows arc length so the stone's block scale stays even around
      // the sweep; V follows real height for the same reason.
      uvs.push(u, y / CROWN_HEIGHT)
    }
    grid.push(row)
  }

  const indices = []
  for (let iy = 0; iy < HEIGHT_SEGMENTS; iy += 1) {
    for (let ix = 0; ix < RADIAL_SEGMENTS; ix += 1) {
      // Cell centre, used for the opening tests.
      const theta = -Math.PI + ((ix + 0.5) / RADIAL_SEGMENTS) * Math.PI * 2
      const vMid = (iy + 0.5) / HEIGHT_SEGMENTS
      const yMid =
        vMid <= SPLIT
          ? (vMid / SPLIT) * SPRINGING_HEIGHT
          : SPRINGING_HEIGHT +
            (CROWN_HEIGHT - SPRINGING_HEIGHT) * Math.sin(((vMid - SPLIT) / (1 - SPLIT)) * Math.PI * 0.5)

      // Front mouth — an arched opening the camera leaves through. The
      // half-angle holds at full width up to the springing of the arch,
      // then eases to zero at its crown, so the opening closes in a curve
      // rather than stopping against a flat lintel.
      if (yMid < MOUTH_HEIGHT) {
        const shoulder = MOUTH_HEIGHT * MOUTH_SHOULDER
        const taper =
          yMid <= shoulder ? 1 : Math.cos(((yMid - shoulder) / (MOUTH_HEIGHT - shoulder)) * Math.PI * 0.5)
        if (Math.abs(theta) < OPENING_HALF_ANGLE * taper) continue
      }

      // Breach — an irregular hole in the +X wall.
      const dTheta = theta - breachTheta
      if (Math.abs(dTheta) < 0.6) {
        const arcOffset = dTheta * breachArcScale
        const dy = yMid - GALLERY_SHELL.breach.centerY
        const ang = Math.atan2(dy, arcOffset)
        const rr = fractureRadius(ang)
        const nx = arcOffset / (GALLERY_SHELL.breach.radiusArc * rr)
        const ny = dy / (GALLERY_SHELL.breach.radiusY * rr)
        if (nx * nx + ny * ny < 1) continue
      }

      const a = grid[iy][ix]
      const b = grid[iy][ix + 1]
      const c = grid[iy + 1][ix + 1]
      const d = grid[iy + 1][ix]
      // Inward-facing winding.
      indices.push(a, d, b, b, d, c)
    }
  }

  // Cap the crown. The swept surface is a tube: closed around theta, but
  // open at both ends. The floor mesh covers the bottom; the top would
  // otherwise be left as a narrow open slot running the length of the
  // ridge — a hole in the roof, found by a straight-up ray test from the
  // floor rather than by looking at it, since from inside the room the
  // slot is edge-on and nearly invisible until the Campaigns pull-back
  // puts the ceiling in frame.
  //
  // The two long sides of that slot are mirror images: the vertex at
  // +theta and the one at -theta share a z and differ only in the sign of
  // x. Stitching each to its mirror closes the slot with a flat ridge
  // band, which is also what a real barrel vault has at its crown.
  const crown = grid[HEIGHT_SEGMENTS]
  const half = RADIAL_SEGMENTS / 2
  for (let ix = 0; ix < half; ix += 1) {
    const left = crown[ix]
    const leftNext = crown[ix + 1]
    const right = crown[RADIAL_SEGMENTS - ix]
    const rightNext = crown[RADIAL_SEGMENTS - ix - 1]
    if (left === right || leftNext === rightNext) continue
    // Wound to face down, into the room.
    indices.push(left, right, leftNext, leftNext, right, rightNext)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
