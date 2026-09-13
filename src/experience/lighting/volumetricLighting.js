import * as THREE from 'three'
import { GALLERY_SHELL, planPoint, roofOpeningBoundarySegments } from '../architecture/galleryShellGeometry.js'
import { circleOfConfusionGLSL, depthOfFieldUniforms } from '../postprocessing/depthOfFieldShared.js'

/**
 * Airborne dust lives in its own scene rather than the room's. `DepthOfField`'s
 * `DustPass` draws it after the blur; the main render, the ambient occlusion and
 * the blur's depth never see it, and drawing it does not re-walk the room's
 * scene graph — measured, that walk alone cost more than the dust itself.
 */
export const dustScene = new THREE.Scene()
dustScene.name = 'AirborneDustScene'

/**
 * The composition anchor — the point on the floor the production ensemble is
 * built around.
 *
 * This used to be `spot.target`, the artificial spotlight's aim point, and
 * `plinthAnchor.js` derives `BEAM_CENTER` from it, which in turn places the
 * monitor, the camera stand and the entire scroll destination in
 * `cameraPath.js`. The spotlight is gone, but the composition it anchored is
 * approved and must not move, so the value outlives the light that produced
 * it. It is a SPATIAL constant now, not a lighting one — nothing here aims
 * at it any more.
 */
export const COMPOSITION_ANCHOR = [0.6, 0, -3.5]

/** Roof opening, read from the architecture rather than restated here. */
const OPENING = GALLERY_SHELL.roofOpening

/**
 * Lighting parameters — the single source of truth for the room's lighting.
 *
 * **This room is now lit by the sky.** Phase 1 cut a 10 x 11 court through
 * the roof; everything below follows from that hole existing. The previous
 * scheme was a theatrical one — a single 340-intensity SpotLight jammed
 * inside a breach in the +X wall, aimed at a floor mark, with a cone mesh and
 * a painted floor pool standing in for a beam it could not really cast. It
 * has been removed entirely. What replaces it is an ordinary daylight
 * hierarchy:
 *
 *  - `sun`    — a DirectionalLight outside the building. Parallel rays, the
 *               room's only shadow caster, and the only light that has to be
 *               occluded by the roof for any of this to read.
 *  - `sky`    — hemisphere. Open sky above, warm stone bounce below. This is
 *               what makes the room legible before the sun arrives, and it is
 *               deliberately the largest term at progress 0.
 *  - `bounce` — warm, non-shadowing, standing for light coming back off the
 *               sunlit floor. There is no GI in this scene; without this term
 *               every surface the sun does not touch falls to sky alone.
 *  - `fill`   — cool, non-shadowing, opposite side. Keeps the shaded flank of
 *               the columns from going to a single flat value.
 *
 * **Two states, not dark-to-light.** `setIgnition` no longer ramps a room out
 * of blackness. It moves the room from SKYLIT to SUNLIT: at 0 the court is
 * open and the sky is coming through it, so floor, columns, walls, vault and
 * the depth between them are all readable; at 1 the sun itself has come round
 * into the opening and the hard shaft lands. That is a real thing light does
 * in a room like this, and it keeps the opening frame exposed rather than
 * black — see the daylight-legibility requirement.
 */
export const lightingParams = {
  /**
   * The sun.
   *
   * Its direction is not a free choice — it is solved backwards from the
   * hole. `elevationDegrees` and `azimuthDegrees` place the sun, and
   * `floorTargetFor` below drops a ray from the middle of the opening to the
   * floor along that direction, so the light provably passes through the
   * court rather than through the roof.
   *
   * Both numbers were measured in the running scene, not reasoned to.
   *
   * The elevation is constrained hard by the room: the court sits 12.4 above
   * the floor of a hall only 20 wide, so the horizontal throw is
   * `12.4 / tan(elevation)`. At the low raking angle of the reference the
   * patch lands 20+ units out — through the wall, never touching the floor.
   * The first pass used 64 degrees and it looked wrong for a reason that only
   * showed up on screen: the shaft landed 5.95 out, which is just OUTSIDE the
   * 5.5 pillar ring, so the sunlit floor sat behind the columns and the
   * camera spent the whole opening orbit looking at shade.
   *
   * The azimuth is what buys the elevation back. Swinging it from 39 toward
   * 70 turns the throw across the room rather than down it, so at 68 degrees
   * the patch lands at (-4.71, -5.71) — 5.01 from the ring centre, INSIDE the
   * ring and on the sightline the camera holds through the orbit — while the
   * sun sits four degrees lower than the version that missed. It also keeps
   * the sun over the camera's shoulder, so the columns are front-lit and read
   * as solid rather than being rimmed into silhouettes.
   */
  sun: {
    color: '#ffe8c6',
    /** Full sun, once it has come round into the opening. */
    intensity: 6.0,
    /**
     * Before it does. Zero, not a low value: this is the whole point of the
     * two-state design — at progress 0 there is no direct sun in the room at
     * all, only sky, and every bit of the room's legibility at that moment
     * comes from `sky` and `bounce` below rather than from a dimmed sun.
     */
    skylitIntensity: 0,
    elevationDegrees: 68,
    /** Degrees from +Z toward +X. */
    azimuthDegrees: 70,
    /** How far outside the building to stand the light. Direction is all that matters; this only has to clear the roof. */
    distance: 46,
  },
  sky: {
    /** Open daylight coming straight down through the court. */
    sky: '#93b0d4',
    /**
     * The floor-bounce term, and the main piece of indirect lighting here.
     *
     * A hemisphere light blends sky above to ground below by surface normal,
     * so a downward-facing surface receives 100% of this colour and nothing
     * else. That is exactly what light returning off a sunlit stone floor
     * does, and it is why the ceiling either side of the court was the
     * blackest thing in frame before this pass: the ground term was too dark
     * and too grey to stand for a floor with sunlight on it. Warmed and lifted
     * from '#a8865c'.
     *
     * It carries the vertical surfaces too — a column face sits at the 50/50
     * mix of sky and ground — so this is half of what keeps a shaded shaft
     * readable.
     */
    ground: '#c9a273',
    /**
     * The same term before the sun arrives. Cool and near-neutral, because at
     * ignition 0 there is no sun in the room and so nothing warm for the floor
     * to be bouncing. `setIgnition` crossfades between the two, so the warmth
     * arrives with the light that justifies it instead of being painted on
     * from the first frame.
     */
    groundSkylit: '#6f6d68',
    /**
     * With the sun in the room the sky is no longer carrying it, and this has
     * to come DOWN as the sun comes up or there is no shade for the sunlight
     * to alternate with. Measured against the sun rather than chosen: at 1.35
     * the lit and unlit floor were within a few percent of each other and the
     * patch did not read at all.
     *
     * 0.95 -> 1.25 for the indirect pass. This is the broad normal-varying
     * term, so it lifts shade without flattening the way a flat ambient would:
     * every surface still receives a different amount depending on which way
     * it faces.
     */
    intensity: 1.25,
    /**
     * At progress 0 this is very nearly the whole room, so it is the number
     * that decides whether the opening frame is legible on a bright screen.
     * Raised over the lit value for that reason, and only that reason.
     */
    skylitIntensity: 2.0,
  },
  /**
   * Light off the sunlit floor.
   *
   * Rises with the sun because it IS the sun, one bounce later — which also
   * means it is the term that reveals the wall inscription. The sun's own
   * shaft never reaches the back wall (the roof shadows everything past
   * z = -11), so `wallInscription.js`'s bronze has nothing directional to
   * catch except this. Positioned low and forward rather than overhead, both
   * because bounce comes off the floor and because that puts more of it on
   * the back wall's face.
   */
  bounce: {
    color: '#ffd9a8',
    /** 0.65 -> 0.95, alongside the re-aim below. */
    intensity: 0.95,
    skylitIntensity: 0.08,
    /**
     * How far BELOW the floor this stands, and what it aims at.
     *
     * It used to sit at [3, 6, 5] — above the room, shining down — and that
     * was simply the wrong shape for what it is meant to be. Light bouncing
     * off a sunlit floor travels UPWARD. A warm light placed overhead is just
     * a second sun: it lit the surfaces the real sun was already lighting and
     * left the ceiling and every downward-facing surface untouched, which is
     * why those went black.
     *
     * It now stands under the sunlit patch — position derived from
     * `sunFloorTarget()` so it tracks the sun rather than being typed in — and
     * aims up into the room. That gives the indirect light a DIRECTION, which
     * is the one thing the hemisphere term cannot provide: surfaces facing the
     * sunlit floor come up, surfaces facing away stay down, and the shade
     * keeps its modelling instead of turning into flat ambient.
     */
    depth: 4.5,
    aim: [0, 2.5, -4],
  },
  /**
   * Cool sky fill from the shaded flank, non-shadowing so it can never
   * introduce a second shadow source. Falls as the sun rises: its job is to
   * keep the unlit side readable, and the brighter the room gets the less of
   * it that takes.
   */
  fill: {
    color: '#b9c9dd',
    intensity: 0.28,
    skylitIntensity: 0.6,
    position: [-6, 5, -2],
  },
  shadow: {
    mapSize: 4096,
    /**
     * The sun is a DirectionalLight, so its shadow camera is orthographic and
     * has to span the whole building rather than a cone. 26 covers the
     * 20 x 38 footprint with margin for the shear a 64-degree sun puts into
     * the projection; at 4096 that is ~13mm per texel, which is what keeps
     * the roof opening's edge a hard line on the floor instead of a soft
     * gradient.
     */
    halfExtent: 26,
    near: 10,
    far: 100,
    bias: -0.0004,
    normalBias: 0.04,
  },
  /**
   * NOTE: fog is deliberately untouched this phase. `fog.color` is not local
   * to this room — `campaigns/River.jsx` and `campaigns/NightSky.jsx` both
   * read it to build the Act 3 NIGHT exterior, so warming it for a sunlit
   * interior would recolour a night sky. It is the largest remaining lever on
   * distant-surface darkness (at 24 units it mixes 36% of this dark grey into
   * everything) and it belongs to the atmosphere pass, with a per-act value.
   */
  fog: {
    color: '#2c2c30',
    density: 0.028,
  },
  /**
   * The visible shaft of air in the light.
   *
   * A placeholder, and flagged as one: the opening is rectangular and this is
   * still the cone `buildBeam` makes, so it is carried at a low enough
   * opacity to read as air rather than as a solid volume with the wrong
   * shape. A real rectangular shaft is atmosphere work, not lighting.
   *
   * The floor pool that used to sit under it is GONE. It was an additive
   * disc faking the light landing, from a time when no light actually could;
   * the sun now casts a real, roof-shaped patch, and leaving the disc would
   * have painted a circle on top of a rectangle.
   */
  shaft: {
    color: '#ffe8c6',
    /**
     * Very low, and it has to be. The volume is now the true shape of the
     * aperture, and that aperture is 10 x 11 over a room only 20 wide — so
     * unlike the old cone, the lit volume genuinely occupies most of the
     * interior and covers most of the frame from almost anywhere the camera
     * stands. Tuned down by eye against the real frames: at 0.10 it washed the
     * back wall and ceiling into haze, at 0.035 it still flattened them. The
     * shell is deliberately almost subliminal here — it establishes where the
     * light is, and the DUST is what makes it visible, which is the way round
     * the brief asks for.
     */
    opacity: 0.022,
    /**
     * How far down the sun vector the visible volume is drawn, as a fraction
     * of the throw from the opening to the floor. Held under 1 so the shaft
     * dies into the air rather than terminating on the floor in a hard edge —
     * the real patch of light on the ground is the sun's own shadow-mapped
     * pool, and the volume only has to explain how it got there.
     */
    lengthFraction: 0.95,
  },
  /**
   * Airborne dust through the whole room, visible where the sun reaches it.
   *
   * Real dust is everywhere; a sunbeam only makes the motes crossing it visible.
   * So the field fills the hall, and each mote is lit by the sun's own shadow
   * map — bright inside the beam, dark in the roof's shadow — rather than being
   * placed inside a hand-built volume.
   */
  dust: {
    color: '#ffe9c9',
    /** Across the whole hall; only the share inside the beam is ever visible. */
    count: 2600,
    /** Mote diameters in world units. Most are small; a few are large. */
    sizeMin: 0.003,
    sizeMax: 0.016,
    /** Overall gain on the scattered light. */
    brightness: 0.9,
    /** Forward scattering: motes glow brighter when the camera looks toward the sun through them. */
    anisotropy: 0.6,
    /** Headroom of height kept free under the vault. */
    ceilingClearance: 0.8,
  },
}

/** Unit vector pointing at the sun. */
export function sunDirection(params = lightingParams) {
  const elevation = THREE.MathUtils.degToRad(params.sun.elevationDegrees)
  const azimuth = THREE.MathUtils.degToRad(params.sun.azimuthDegrees)
  const horizontal = Math.cos(elevation)
  return new THREE.Vector3(
    Math.sin(azimuth) * horizontal,
    Math.sin(elevation),
    Math.cos(azimuth) * horizontal,
  )
}

/**
 * Where the shaft through the court lands on the floor.
 *
 * Solved, not chosen: a ray dropped from the centre of the roof opening along
 * the sun's own direction. This is what guarantees the light and the hole
 * agree — change the elevation and the patch moves the way a real one would,
 * with nothing to keep in sync by hand.
 */
export function sunFloorTarget(params = lightingParams) {
  const direction = sunDirection(params)
  const travel = OPENING.crownHeight / direction.y
  return new THREE.Vector3(
    OPENING.centerX - direction.x * travel,
    0,
    OPENING.centerZ - direction.z * travel,
  )
}

/**
 * The visible shaft — the actual shape of the hole, extruded along the sun.
 *
 * This replaces a cone. The cone was honest about being a placeholder: it was
 * built from a half-angle and a length because the old light was a SpotLight,
 * which really does emit a cone. Nothing about this room emits a cone any
 * more. Sunlight is parallel, so the volume it lights is a PRISM — the hole's
 * own outline, swept along the sun vector, with parallel sides that do not
 * spread. A cone hanging under a 10 x 11 irregular opening reads as a stage
 * effect precisely because its silhouette has nothing to do with the aperture
 * it claims to come from.
 *
 * Built by extruding `roofOpeningBoundarySegments()` — the same segments the
 * stone rim is built from, so the light and the hole are the same shape by
 * construction and cannot drift apart. Alignment with the DirectionalLight is
 * likewise structural rather than tuned: the extrusion direction IS the sun
 * vector.
 *
 * Additive, `depthWrite: false`, `DoubleSide`, so it reads as a soft volume
 * from any angle without a depth prepass or raymarching. The fragment shader
 * does the work that keeps it from being a solid slab:
 *
 *  - it fades out along the shaft, so the light dies into the room rather
 *    than ending;
 *  - it fades toward EDGE-ON viewing via the fresnel-style term, which is the
 *    detail that stops the prism reading as glass. A volume of illuminated
 *    haze is brightest where you look through the most of it — down its
 *    length — and nearly invisible where you look across its skin.
 */
function buildShaft(params, direction, length) {
  const segments = roofOpeningBoundarySegments()
  const positions = []
  const travel = []
  const indices = []

  for (const [a, b] of segments) {
    const base = positions.length / 3
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    travel.push(0, 0)
    positions.push(
      a.x + direction.x * length,
      a.y + direction.y * length,
      a.z + direction.z * length,
      b.x + direction.x * length,
      b.y + direction.y * length,
      b.z + direction.z * length,
    )
    travel.push(1, 1)
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aTravel', new THREE.Float32BufferAttribute(travel, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(params.shaft.color) },
      uOpacity: { value: params.shaft.opacity },
    },
    vertexShader: /* glsl */ `
      attribute float aTravel;
      varying float vTravel;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        vTravel = aTravel;
        vViewNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vTravel;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        // Along the shaft: a short fade in under the opening so the beam does
        // not start at a hard line, then a long fall-off into the room.
        float along = smoothstep(0.0, 0.10, vTravel) * (1.0 - smoothstep(0.45, 1.0, vTravel));

        // Across the shaft: the prism is a hollow shell standing in for a
        // volume, so each wall is faded by how squarely it is being viewed.
        //
        // This started out the other way round — brightest at grazing, on the
        // reasoning that a ray skimming the wall passes through the most haze.
        // That is true of a real volume and wrong for this approximation: a
        // shell has no thickness, so at grazing angles a single quad smears
        // across a huge run of screen and each one announced itself as a hard
        // diagonal streak. Squaring it up instead keeps the wedge reading as a
        // soft body of light and makes the individual quads disappear, which
        // is what the shell was standing in for in the first place.
        float facing = abs(dot(normalize(vViewNormal), normalize(-vViewPosition)));
        float depth = facing * facing;

        gl_FragColor = vec4(uColor, uOpacity * along * depth);
      }
    `,
  })

  return new THREE.Mesh(geometry, material)
}

/** Whether (x, y, z) is inside the hall, vault included, with `margin` to spare. */
function isInsideHall(x, y, z, margin) {
  const springing = GALLERY_SHELL.springingHeight
  const crown = GALLERY_SHELL.crownHeight
  let xScale = 1
  let zScale = 1
  if (y > springing) {
    // Same section as the shell's own vault (`shellSection`): the plan narrows
    // as the roof curves over.
    const arc = THREE.MathUtils.clamp((y - springing) / (crown - springing), 0, 1)
    const tuck = Math.cos(Math.asin(arc))
    xScale = 0.05 + 0.95 * tuck
    zScale = 1 - 0.35 * (1 - tuck)
  }
  const px = x / xScale
  const pz = z / zScale
  const edge = planPoint(Math.atan2(px, pz))
  return Math.hypot(px, pz) < Math.hypot(edge.x, edge.z) - margin
}

/**
 * Airborne dust, lit by the sun where the sun actually reaches.
 *
 * **Why it had disappeared.** The old field lived only inside a hand-built
 * copy of the shaft, and each mote was drawn at a fixed one-to-two pixels.
 * Since the room gained its depth-of-field pass, almost all of it sits well
 * off the focal plane, and a gathering blur averages a one-pixel speck into
 * the pixels around it until nothing is left. Its opacity was also tied to the
 * sun's arrival, so on the opening frames it was exactly zero.
 *
 * **What replaces it.**
 *
 *  - The field fills the hall in world space, so it has real depth and
 *    parallax from every viewpoint, not only where the shaft is.
 *  - Each mote samples the sun's existing shadow map in the vertex shader: it
 *    is lit inside the beam and dark in the roof's shadow, so the beam reveals
 *    the dust exactly where the light falls, with the same soft edge as the
 *    patch on the floor. No extra shadow pass, no geometry for the beam.
 *  - Forward scattering (a Henyey-Greenstein lobe) makes motes brighter when
 *    the camera looks toward the sun through them, which is when real dust is
 *    most visible.
 *  - It is drawn AFTER the blur, from `dustScene`, and lays out its own defocus
 *    from the same circle of confusion the blur uses (`depthOfFieldShared.js`):
 *    an out-of-focus mote grows into a soft disc and dims as it grows, instead
 *    of being averaged away.
 *  - It is tested against the blur pass's depth of the opaque room, softly, so
 *    motes never show through a column or wall and never cut hard lines where
 *    they meet a surface. Scene fog is applied too.
 *
 * Motion is a slow, irregular drift — two incommensurate sine terms per axis
 * around a fixed base position, with each mote's own speed and phases —
 * bounded, so nothing ever needs wrapping or re-seeding and nothing pops.
 */
function buildDust(params, sunLight) {
  const { count, color, sizeMin, sizeMax, brightness, anisotropy, ceilingClearance } = params.dust
  const positions = new Float32Array(count * 3)
  const phases = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const glints = new Float32Array(count)
  const speeds = new Float32Array(count)
  const top = GALLERY_SHELL.crownHeight - ceilingClearance

  for (let i = 0; i < count; i += 1) {
    let x = 0
    let y = 0
    let z = 0
    for (let attempt = 0; attempt < 24; attempt += 1) {
      x = (Math.random() * 2 - 1) * 10
      y = 0.08 + Math.random() * (top - 0.08)
      z = (Math.random() * 2 - 1) * 19
      if (isInsideHall(x, y, z, 0.3)) break
    }
    positions.set([x, y, z], i * 3)
    phases.set([Math.random() * 6.2832, Math.random() * 6.2832, Math.random() * 6.2832], i * 3)
    // Skewed small: most motes are fine specks, a few are coarse.
    sizes[i] = THREE.MathUtils.lerp(sizeMin, sizeMax, Math.random() ** 2.6)
    // Varied reflectance, with the occasional mote catching the light harder.
    glints[i] = Math.random() < 0.06 ? 1.6 + Math.random() * 0.8 : 0.35 + Math.random() * 0.65
    speeds[i] = 0.6 + Math.random() * 0.9
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aGlint', new THREE.BufferAttribute(glints, 1))
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      ...depthOfFieldUniforms,
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uBrightness: { value: brightness },
      uSunStrength: { value: 0 },
      uSunTravel: { value: sunDirection(params).clone().negate() },
      uAnisotropy: { value: anisotropy },
      uShadowMap: { value: null },
      uShadowMatrix: { value: sunLight.shadow.matrix },
      uShadowMapSize: { value: sunLight.shadow.mapSize },
      uShadowBias: { value: sunLight.shadow.bias },
      uFogDensity: { value: params.fog.density },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <packing>
      ${circleOfConfusionGLSL}
      uniform float uTime;
      uniform float uBrightness;
      uniform float uSunStrength;
      uniform vec3 uSunTravel;
      uniform float uAnisotropy;
      uniform sampler2D uShadowMap;
      uniform mat4 uShadowMatrix;
      uniform vec2 uShadowMapSize;
      uniform float uShadowBias;
      uniform float uFogDensity;
      uniform float uFocus;
      uniform float uAperture;
      uniform float uMaxBlur;
      uniform vec2 uResolution;
      attribute vec3 aPhase;
      attribute float aSize;
      attribute float aGlint;
      attribute float aSpeed;
      varying float vIntensity;
      varying float vDefocus;
      varying float vViewZ;

      float sunlit( vec3 worldPosition ) {
        vec4 coord = uShadowMatrix * vec4( worldPosition, 1.0 );
        vec3 sc = coord.xyz / coord.w;
        if ( sc.x <= 0.0 || sc.x >= 1.0 || sc.y <= 0.0 || sc.y >= 1.0 || sc.z >= 1.0 ) return 0.0;
        float z = sc.z + uShadowBias;
        vec2 texel = 2.0 / uShadowMapSize;
        // Five taps, so a mote crossing the beam's edge fades rather than blinks.
        float lit = step( z, unpackRGBAToDepth( texture2D( uShadowMap, sc.xy ) ) );
        lit += step( z, unpackRGBAToDepth( texture2D( uShadowMap, sc.xy + vec2( texel.x, 0.0 ) ) ) );
        lit += step( z, unpackRGBAToDepth( texture2D( uShadowMap, sc.xy - vec2( texel.x, 0.0 ) ) ) );
        lit += step( z, unpackRGBAToDepth( texture2D( uShadowMap, sc.xy + vec2( 0.0, texel.y ) ) ) );
        lit += step( z, unpackRGBAToDepth( texture2D( uShadowMap, sc.xy - vec2( 0.0, texel.y ) ) ) );
        return lit / 5.0;
      }

      void main() {
        // Slow, irregular drift: two incommensurate terms per axis, per-mote
        // phase and speed. Centimetres a second at most, bounded around home.
        float t = uTime * aSpeed;
        vec3 worldPosition = position + vec3(
          sin( t * 0.031 + aPhase.x ) * 0.32 + sin( t * 0.083 + aPhase.y * 1.7 ) * 0.1,
          sin( t * 0.023 + aPhase.y ) * 0.2 + sin( t * 0.067 + aPhase.z * 2.3 ) * 0.07,
          sin( t * 0.029 + aPhase.z ) * 0.32 + sin( t * 0.091 + aPhase.x * 1.3 ) * 0.1
        );

        vec4 mvPosition = modelViewMatrix * vec4( worldPosition, 1.0 );
        float distance = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        vViewZ = mvPosition.z;

        float light = uSunStrength > 0.0 ? sunlit( worldPosition ) * uSunStrength : 0.0;

        // Henyey-Greenstein: strongest when the camera sits downstream of the
        // light, looking back toward the sun through the mote.
        vec3 toCamera = normalize( cameraPosition - worldPosition );
        float cosTheta = dot( toCamera, uSunTravel );
        float g = uAnisotropy;
        float hg = ( 1.0 - g * g ) / pow( max( 1.0 + g * g - 2.0 * g * cosTheta, 1e-4 ), 1.5 );
        float scatter = 0.3 + 0.2 * hg;

        // Size on screen from world size, then grown by the same defocus the
        // blur applies at this depth. Dimmed as it grows, so a defocused mote
        // is a soft disc, not a brighter one.
        float focusedPx = aSize * projectionMatrix[ 1 ][ 1 ] * uResolution.y * 0.5 / max( distance, 0.01 );
        float blurPx = abs( circleOfConfusion( mvPosition.z, uFocus, uAperture, uMaxBlur ) ) * uResolution.x * 2.0;
        float shownPx = clamp( sqrt( focusedPx * focusedPx + blurPx * blurPx ), 1.5, 36.0 );
        float spread = max( focusedPx, 0.35 ) / shownPx;
        vDefocus = clamp( blurPx / shownPx, 0.0, 1.0 );

        float fog = exp( -uFogDensity * uFogDensity * distance * distance );
        // Never let a mote swell across the lens as the camera passes it.
        float nearFade = smoothstep( 0.35, 1.2, distance );

        vIntensity = light * scatter * aGlint * uBrightness * spread * fog * nearFade;
        // Nothing to draw: collapse the sprite so it costs no fill.
        gl_PointSize = vIntensity > 0.002 ? shownPx : 0.0;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <packing>
      uniform vec3 uColor;
      uniform sampler2D uSceneDepth;
      uniform float uNearClip;
      uniform float uFarClip;
      uniform vec2 uResolution;
      varying float vIntensity;
      varying float vDefocus;
      varying float vViewZ;

      void main() {
        float r = length( gl_PointCoord - 0.5 ) * 2.0;
        if ( r >= 1.0 ) discard;
        // In focus: a soft speck with no rim. Defocused: a flatter disc with a
        // soft edge, the way out-of-focus dust reads through a real lens.
        float speck = exp( -r * r * 5.0 );
        float disc = ( 1.0 - smoothstep( 0.55, 1.0, r ) ) * 0.8;
        float shape = mix( speck, disc, vDefocus );

        // Soft occlusion against the opaque room: fully hidden behind geometry,
        // faded in over a few centimetres where a mote nears a surface.
        vec2 screenUv = gl_FragCoord.xy / uResolution;
        float sceneZ = perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( uSceneDepth, screenUv ) ), uNearClip, uFarClip );
        float visible = clamp( ( vViewZ - sceneZ ) / 0.12, 0.0, 1.0 );

        float alpha = vIntensity * shape * visible;
        if ( alpha <= 0.0005 ) discard;
        gl_FragColor = vec4( uColor, alpha );
      }
    `,
  })

  const points = new THREE.Points(geometry, material)
  points.name = 'AirborneDust'
  // Drift moves motes off their base positions; the field spans the room anyway.
  points.frustumCulled = false
  return points
}

/**
 * Framework-agnostic controller for the room's lighting. Geometry (the
 * beam's truncation) is still what keeps the camera from ever entering
 * the beam volume, independent of intensity — see `beam.lengthFraction`
 * above. Intensity itself IS scroll-coupled as of `setIgnition` below: a
 * dramatic dark-to-light reveal, added per explicit request, superseding
 * this module's earlier "fully static by design" posture from the §4D/§4G
 * rebuild. That posture was this codebase's own implementation choice,
 * not a protected/approved decision — the room's light *character* is
 * what's protected (see build-status.md §5's Phase 1B entry), and this
 * reveal doesn't change that character, only its timing.
 */
export function createVolumetricLighting(params = lightingParams) {
  const group = new THREE.Group()
  group.name = 'VolumetricLighting'

  let sunLight = null
  let sunTarget = null
  let bounceLight = null
  let bounceTarget = null
  let fillLight = null
  let hemisphereLight = null
  let beam = null
  let dust = null

  // Endpoints of the ground-colour crossfade in `setIgnition`, built once
  // rather than parsed per frame.
  const skylitGround = new THREE.Color(params.sky.groundSkylit)
  const sunlitGround = new THREE.Color(params.sky.ground)

  function init() {
    const floorTarget = sunFloorTarget(params)
    const origin = floorTarget.clone().addScaledVector(sunDirection(params), params.sun.distance)

    /**
     * A DirectionalLight, not a SpotLight, and that is the substantive change
     * in this phase rather than a detail of it. The sun is 150 million km
     * away: its rays are parallel, it has no inverse-square falloff and no
     * cone, so a near surface and a far one facing the same way receive the
     * same illuminance. A SpotLight cannot express that at any settings — the
     * previous one needed intensity 340 and `decay: 2` precisely because it
     * was a lamp in the room pretending not to be.
     *
     * It is also the room's only shadow caster, which is what makes the roof
     * opening mean anything: the shape of the light on the floor is the shape
     * of the hole, cast by the roof, not a painted disc.
     */
    sunLight = new THREE.DirectionalLight(params.sun.color, params.sun.skylitIntensity)
    sunLight.position.copy(origin)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.set(params.shadow.mapSize, params.shadow.mapSize)
    sunLight.shadow.bias = params.shadow.bias
    sunLight.shadow.normalBias = params.shadow.normalBias

    const { halfExtent, near, far } = params.shadow
    const camera = sunLight.shadow.camera
    camera.left = -halfExtent
    camera.right = halfExtent
    camera.top = halfExtent
    camera.bottom = -halfExtent
    camera.near = near
    camera.far = far
    camera.updateProjectionMatrix()

    sunTarget = new THREE.Object3D()
    sunTarget.position.copy(floorTarget)
    sunLight.target = sunTarget

    // Both non-shadowing, so neither can introduce a second shadow source —
    // the sun owns every shadow in this room.
    bounceLight = new THREE.DirectionalLight(params.bounce.color, params.bounce.skylitIntensity)
    bounceLight.position.set(floorTarget.x, -params.bounce.depth, floorTarget.z)
    bounceLight.castShadow = false
    bounceTarget = new THREE.Object3D()
    bounceTarget.position.set(...params.bounce.aim)
    bounceLight.target = bounceTarget

    fillLight = new THREE.DirectionalLight(params.fill.color, params.fill.skylitIntensity)
    fillLight.position.set(...params.fill.position)
    fillLight.castShadow = false

    hemisphereLight = new THREE.HemisphereLight(
      params.sky.sky,
      params.sky.ground,
      params.sky.skylitIntensity,
    )

    // Both volumetrics are built from the aperture itself and swept along the
    // sun vector, so the light in the air, the hole it comes through and the
    // DirectionalLight casting it are all the same geometry by construction.
    const down = sunDirection(params).clone().negate()
    const throwLength = (OPENING.crownHeight / -down.y) * params.shaft.lengthFraction
    beam = buildShaft(params, down, throwLength)
    dust = buildDust(params, sunLight)

    group.add(sunLight, sunTarget, bounceLight, bounceTarget, fillLight, hemisphereLight, beam)
    dustScene.add(dust)

    // Start in the skylit state rather than at full sun, so there is never a
    // frame of the lit room before the first `useFrame` lands.
    setIgnition(0)
  }

  /**
   * Moves the room from SKYLIT (`factor` 0) to SUNLIT (1).
   *
   * Not a dark-to-light ramp any more. At 0 the court is open and the sky is
   * coming through it: the room is fully readable, just flatter, cooler and
   * without a shaft. At 1 the sun has come round into the opening. Every
   * light interpolates between two real values rather than being multiplied
   * toward zero, which is why nothing is ever black at the start now.
   *
   * Driven by direct property mutation from `VolumetricLightingRig`'s
   * `useFrame`, not React state, per technical-architecture.md §7.
   */
  function setIgnition(factor) {
    const lerp = THREE.MathUtils.lerp
    if (sunLight) sunLight.intensity = lerp(params.sun.skylitIntensity, params.sun.intensity, factor)
    if (bounceLight) {
      bounceLight.intensity = lerp(params.bounce.skylitIntensity, params.bounce.intensity, factor)
    }
    if (fillLight) fillLight.intensity = lerp(params.fill.skylitIntensity, params.fill.intensity, factor)
    if (hemisphereLight) {
      hemisphereLight.intensity = lerp(params.sky.skylitIntensity, params.sky.intensity, factor)
      // The floor only bounces warm light once there is sun on it — see
      // `sky.groundSkylit`.
      hemisphereLight.groundColor.copy(skylitGround).lerp(sunlitGround, factor)
    }
    // The shaft and its dust are the one thing that genuinely is absent until
    // the sun arrives — there is no beam in the air without a beam.
    if (beam) beam.material.uniforms.uOpacity.value = params.shaft.opacity * factor
    // Dust is lit by the sun itself, so it follows the sun's real intensity.
    if (dust) dust.material.uniforms.uSunStrength.value = sunLight.intensity / params.sun.intensity
  }

  /** Advances the dust's drift and keeps its view of the sun's shadow map current — see `buildDust`. */
  function setTime(t) {
    if (!dust) return
    dust.material.uniforms.uTime.value = t
    // The shadow map is only allocated on the renderer's first shadow pass.
    if (sunLight.shadow.map) dust.material.uniforms.uShadowMap.value = sunLight.shadow.map.texture
  }

  function update() {
    // Still a no-op — scroll-coupling happens through `setIgnition` and
    // `setTime`, called directly from `VolumetricLightingRig`'s `useFrame`.
  }

  function dispose() {
    beam?.geometry.dispose()
    beam?.material.dispose()
    if (dust) dustScene.remove(dust)
    dust?.geometry.dispose()
    dust?.material.dispose()
    group.clear()
  }

  return { group, params, init, update, dispose, setIgnition, setTime }
}
