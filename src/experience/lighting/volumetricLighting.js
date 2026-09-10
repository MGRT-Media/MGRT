import * as THREE from 'three'
import { GALLERY_SHELL } from '../architecture/galleryShellGeometry.js'

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
    /** Warm, off the stone floor it has already hit. */
    ground: '#a8865c',
    /**
     * With the sun in the room the sky is no longer carrying it, and this has
     * to come DOWN as the sun comes up or there is no shade for the sunlight
     * to alternate with. Measured against the sun rather than chosen: at 1.35
     * the lit and unlit floor were within a few percent of each other and the
     * patch did not read at all.
     */
    intensity: 0.95,
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
    intensity: 0.65,
    skylitIntensity: 0.08,
    position: [3, 6, 5],
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
    opacity: 0.05,
    angle: 0.3,
    lengthFraction: 0.72,
    radialSegments: 24,
  },
  dust: {
    color: '#fff6e8',
    count: 720,
    sizeSmall: 0.022,
    sizeLarge: 0.075,
    opacity: 0.26,
    topBias: 2.4,
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

/** Perpendicular basis for offsetting points around the beam's own axis. */
function buildRadialBasis(axis) {
  const arbitrary = Math.abs(axis.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const u = new THREE.Vector3().crossVectors(axis, arbitrary).normalize()
  const v = new THREE.Vector3().crossVectors(axis, u).normalize()
  return { u, v }
}

/**
 * The visible light beam: a single open-ended cone, apex at the light
 * source, extending only `beam.lengthFraction` of the way toward the
 * floor target — see the comment on that param for why. Additive,
 * `depthWrite: false`, `DoubleSide` so it reads as a soft volume from any
 * angle without needing a depth-texture pass or raymarching.
 */
function buildBeam(params, origin, target) {
  const axisVec = target.clone().sub(origin)
  const fullLength = axisVec.length()
  const axis = axisVec.clone().normalize()

  const beamLength = fullLength * params.shaft.lengthFraction
  const radius = Math.tan(params.shaft.angle) * beamLength

  const geometry = new THREE.ConeGeometry(radius, beamLength, params.shaft.radialSegments, 1, true)
  // Apex defaults to local +height/2; shift so the apex sits at the local
  // origin and the (open) base trails off along local -Y.
  geometry.translate(0, -beamLength / 2, 0)

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
      varying float vT;
      void main() {
        // Local Y: 0 at the apex (light source), -beamLength at the open
        // (far) end. vT: 0 at the apex, 1 at the far end.
        vT = clamp(-position.y / ${beamLength.toFixed(6)}, 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vT;
      void main() {
        // Fade in just past the apex (avoids a hard point) and fade out
        // toward the open far end (it's floating in air, not capped, so a
        // soft trail-off reads as atmospheric rather than truncated).
        float fade = smoothstep(0.0, 0.15, vT) * (1.0 - smoothstep(0.7, 1.0, vT));
        gl_FragColor = vec4(uColor, uOpacity * fade);
      }
    `,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(origin)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis)

  return mesh
}

/**
 * A dust field confined to the full beam volume (origin to floor target —
 * dust can sit lower than the visible beam mesh itself, since individual
 * points don't create the "camera inside a shell" issue a hollow cone
 * does). Base positions are generated once; each point then drifts around
 * its own base position every frame, entirely on the GPU (a per-vertex
 * sine/cosine offset driven by a `uTime` uniform, updated from
 * `VolumetricLightingRig`'s `useFrame`) — a slow, gentle air-current
 * wobble, not a particle simulation with velocity or state. Because the
 * offset is a bounded oscillation around each point's fixed base position
 * (not an accumulating drift), points never need to be wrapped/looped
 * back into bounds — they can't wander out in the first place.
 *
 * Points are distributed along the beam axis with `dust.topBias` biasing
 * them toward the light source (t = 0) rather than spread uniformly —
 * `Math.random() ** topBias` skews a uniform sample toward 0 for any
 * exponent > 1, so most points cluster near the top while a sparse tail
 * still drifts all the way down to the floor target.
 *
 * Size and motion both key off that same `t` (0 = top/breach, 1 = floor):
 * small, fast-wobbling specks near the top; larger, heavier ones with a
 * slower wobble plus a slow *continuous* upward drift near the bottom,
 * where the arc pillars and floor are. The continuous drift is the one
 * departure from the "bounded oscillation only" design above — it's kept
 * bounded too, via `mod()` cycling it within a small fixed range, so nothing
 * ever needs unbounded position wrapping (see the vertex shader).
 */
function buildDust(params, origin, target) {
  const { count, color, opacity, topBias, sizeSmall, sizeLarge } = params.dust
  const fullLength = target.clone().sub(origin).length()
  const axis = target.clone().sub(origin).normalize()
  const { u, v } = buildRadialBasis(axis)
  const maxRadius = Math.tan(params.shaft.angle) * fullLength

  const positions = new Float32Array(count * 3)
  // A per-point random phase offset so points don't oscillate in lockstep
  // (which would read as the whole field pulsing rather than individual
  // specks drifting independently).
  const phases = new Float32Array(count)
  const sizes = new Float32Array(count)
  // Wobble amplitude/frequency multiplier: >1 for small/high specks (the
  // request's "high-velocity"), <1 for large/low ones ("slower, heavier").
  const wobbles = new Float32Array(count)
  // Continuous upward drift speed — near 0 for small/high specks (they
  // stay in their fast bounded wobble instead), larger for heavy ones.
  const drifts = new Float32Array(count)

  for (let i = 0; i < count; i += 1) {
    const t = Math.random() ** topBias
    const center = origin.clone().lerp(target, t)
    const radiusAtT = THREE.MathUtils.lerp(0.05, maxRadius, t)
    const r = radiusAtT * Math.sqrt(Math.random()) * 0.85
    const theta = Math.random() * Math.PI * 2

    const offset = u
      .clone()
      .multiplyScalar(r * Math.cos(theta))
      .add(v.clone().multiplyScalar(r * Math.sin(theta)))

    const point = center.clone().add(offset)
    positions[i * 3] = point.x
    positions[i * 3 + 1] = point.y
    positions[i * 3 + 2] = point.z
    phases[i] = Math.random() * Math.PI * 2

    // Jittered so the size/speed split isn't a mechanically sharp line at
    // a given height — some overlap between "small fast" and "large slow"
    // reads as more organic.
    const sizeT = THREE.MathUtils.clamp(t + (Math.random() - 0.5) * 0.25, 0, 1)
    sizes[i] = THREE.MathUtils.lerp(sizeSmall, sizeLarge, sizeT)
    wobbles[i] = THREE.MathUtils.lerp(1.4, 0.4, sizeT)
    drifts[i] = THREE.MathUtils.lerp(0, 0.05, sizeT)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aWobble', new THREE.BufferAttribute(wobbles, 1))
  geometry.setAttribute('aDrift', new THREE.BufferAttribute(drifts, 1))

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aPhase;
      attribute float aSize;
      attribute float aWobble;
      attribute float aDrift;
      void main() {
        // Cinematic air-current drift — slow, small-amplitude, and
        // self-bounded (a sine/cosine wobble around the base position,
        // scaled per-point by aWobble: >1 for small high specks reads as
        // "high-velocity," <1 for large low ones reads as "heavier").
        vec3 pos = position;
        pos.x += sin(uTime * 0.3 + position.y + aPhase) * 0.05 * aWobble;
        pos.y += cos(uTime * 0.2 + position.x + aPhase) * 0.03 * aWobble;
        pos.z += sin(uTime * 0.25 + position.z + aPhase) * 0.04 * aWobble;

        // Slow continuous upward drift for heavier particles only
        // (aDrift ≈ 0 for small ones) — bounded via mod() into a small
        // cycling range rather than an unbounded climb, so it never needs
        // separate position-wrapping logic.
        float driftRange = 0.6;
        float cyclic = mod(uTime * aDrift + aPhase * driftRange, driftRange) - driftRange * 0.5;
        pos.y += cyclic;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        // Perspective size attenuation, matching THREE.PointsMaterial's
        // own approach (size shrinks with distance from camera).
        gl_PointSize = aSize * (400.0 / -mvPosition.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        // Soft circular sprite instead of a hard-edged square point.
        float d = distance(gl_PointCoord, vec2(0.5));
        float fade = 1.0 - smoothstep(0.3, 0.5, d);
        if (fade <= 0.0) discard;
        gl_FragColor = vec4(uColor, uOpacity * fade);
      }
    `,
  })

  return new THREE.Points(geometry, material)
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
  let fillLight = null
  let hemisphereLight = null
  let beam = null
  let dust = null

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
    bounceLight.position.set(...params.bounce.position)
    bounceLight.castShadow = false

    fillLight = new THREE.DirectionalLight(params.fill.color, params.fill.skylitIntensity)
    fillLight.position.set(...params.fill.position)
    fillLight.castShadow = false

    hemisphereLight = new THREE.HemisphereLight(
      params.sky.sky,
      params.sky.ground,
      params.sky.skylitIntensity,
    )

    // The volumetrics now run down the sun's own shaft, from the middle of
    // the opening to where the light lands, instead of from a hole in the
    // wall to a mark on the floor.
    const shaftOrigin = new THREE.Vector3(OPENING.centerX, OPENING.crownHeight, OPENING.centerZ)
    beam = buildBeam(params, shaftOrigin, floorTarget)
    dust = buildDust(params, shaftOrigin, floorTarget)

    group.add(sunLight, sunTarget, bounceLight, fillLight, hemisphereLight, beam, dust)

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
    }
    // The shaft and its dust are the one thing that genuinely is absent until
    // the sun arrives — there is no beam in the air without a beam.
    if (beam) beam.material.uniforms.uOpacity.value = params.shaft.opacity * factor
    if (dust) dust.material.uniforms.uOpacity.value = params.dust.opacity * factor
  }

  /** Advances the dust field's GPU drift animation — see `buildDust`. */
  function setTime(t) {
    if (dust) dust.material.uniforms.uTime.value = t
  }

  function update() {
    // Still a no-op — scroll-coupling happens through `setIgnition` and
    // `setTime`, called directly from `VolumetricLightingRig`'s `useFrame`.
  }

  function dispose() {
    beam?.geometry.dispose()
    beam?.material.dispose()
    dust?.geometry.dispose()
    dust?.material.dispose()
    group.clear()
  }

  return { group, params, init, update, dispose, setIgnition, setTime }
}
