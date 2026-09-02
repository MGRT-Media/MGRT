import * as THREE from 'three'

/**
 * Lighting parameters — the single source of truth for the room's
 * lighting. Exposed as plain data so later phases can reference these
 * values without touching this module's internals.
 *
 * Three light sources, each with one job:
 *  - `spot`   — the primary practical light: casts the room's only
 *               shadows and drives the visible beam/floor-pool.
 *  - `key`    — a stable, non-shadow-casting directional fill so the
 *               room reads clearly even where the spot doesn't reach.
 *  - `ambient` — flat base fill underneath both.
 */
export const lightingParams = {
  spot: {
    color: '#fff1dc',
    intensity: 55,
    // Repositioned to coincide with the z: -3 clerestory window
    // (`Environment.jsx`'s `Window`, right side wall) so the beam visually
    // originates at the window rather than an unmarked point in space —
    // "key light streams directly through the windows." X re-derived this
    // round from the same 0.15-inside-the-wall offset as before
    // (`HALL_WIDTH / 2 - 0.15`) after `Environment.jsx`'s hall widened
    // 14 -> 20 (wall moved from x: 7 to x: 10) — without this, the breach
    // itself would move to the new wall but the light would stay behind at
    // the OLD wall's position, floating in mid-air instead of shining
    // through the opening. `target` is intentionally unchanged:
    // `Monitor.jsx`'s `MONITOR_ANCHOR.position` and therefore the entire
    // camera path's monitor-aligned endpoint (`cameraPath.js`) are both
    // derived from this exact point, so moving it would silently relocate
    // the monitor and the whole scroll destination — a much bigger change
    // than "reposition the light."
    position: [9.85, 6.3, -3],
    target: [0.6, 0, -3.5],
    angle: 0.32,
    penumbra: 0.92,
    decay: 1.8,
    distance: 24,
  },
  key: {
    color: '#fff1dc',
    intensity: 1.1,
    position: [4, 10, 4],
  },
  // Bounce/fill light on the room's -X side, opposite the breach (+X) —
  // non-shadow-casting, like `key`, so it can't introduce a second shadow
  // source. Purely lifts the shadow-side (left) wall out of near-black so
  // its stone material stays readable even where the breach's direct
  // light doesn't reach, per the readability request.
  fill: {
    color: '#c9cdd6',
    intensity: 0.6,
    position: [-5, 5, -1],
  },
  ambient: {
    color: '#adadb8',
    // Raised 2.3 -> 2.5 (+0.2, within the requested +0.15 to +0.25) so
    // the shadow-side stone surfaces don't drop toward pitch black.
    intensity: 2.5,
    // The scroll-0 starting ambient during the dark-to-light reveal (see
    // VolumetricLightingRig's ignition ramp) — near-total darkness with
    // just enough tint to outline geometry edges, per explicit request.
    // This is a real absolute AmbientLight intensity in this project's
    // established scale (not a 0-1 normalized value), verified visually
    // rather than assumed to read as "near darkness" at this magnitude.
    //
    // Raised substantially, 0.03 -> 1.5, per explicit follow-up direction
    // that the opening must be "dark, but NOT pure black" — specifically
    // legible enough for the pillar/camera/monitor silhouettes to read as
    // shapes ("what am I looking at?"), not just an undifferentiated dark
    // frame. This scene's (R3F default) ACES tonemapping crushes shadows
    // far harder than the raw numbers suggest: 0.05, 0.12, and 0.4 were
    // all tried first and every one still rendered as flat black once
    // tonemapped against these materials' moderate roughness/albedo —
    // confirmed visually via screenshot, not assumed from the number,
    // before landing on 1.5, which reads correctly as dim-but-legible
    // silhouettes without looking "lit." Despite being 60% of the room's
    // full 2.5 established intensity as a raw number, the tonemapped
    // *result* still reads clearly darker/moodier than the established
    // room, not close to it — the perceptual gap the brief cares about is
    // preserved even though the linear-intensity gap looks smaller than
    // the earlier, still-invisible attempts.
    //
    // Caveat: this is measured against the camera positions the early
    // journey actually passes through shortly after progress 0 — the
    // exact progress-0 frame itself sits at §4AY's ORBIT_START_POSITION,
    // a wide, distant establishing view where the pillars subtend a small
    // angle; even at this intensity that specific frame still reads as
    // very close to black in a screenshot (a framing/distance effect, not
    // a lighting bug — verified darkIntensity actually is being applied
    // by confirming clearly-visible silhouettes at the very next camera
    // position along the same path). Flagged rather than silently
    // adjusting the camera's own starting position, which is out of this
    // round's "lighting only" scope.
    darkIntensity: 1.5,
  },
  shadow: {
    mapSize: 2048,
    radius: 4,
    bias: -0.0012,
    normalBias: 0.02,
  },
  fog: {
    color: '#2c2c30',
    density: 0.028,
  },
  beam: {
    color: '#fff1dc',
    opacity: 0.11,
    // How much of the full spot-to-target distance the *visible* beam
    // mesh actually spans, starting from the light source. World Y drops
    // linearly along the beam from `spot.position[1]` (6.3, at the
    // window) to 0 (floor target), so at fraction f the beam's lowest
    // point is at Y = 6.3 * (1 - f) — recalculated after the window
    // reposition (previously Y = 8 * (1 - f) with fraction 0.75, giving
    // Y ≈ 2.0). Lowered to 0.65 here so the new, shallower window-angle
    // beam keeps essentially the same ~2.2 clearance above every camera
    // height in cameraPath.js (max ~1.7) — recomputed, not left at the
    // old value, since the window's lower/shallower origin would
    // otherwise drop the beam's bottom to ~1.57, inside the camera's
    // reachable height range. No scroll-coupling needed to avoid a
    // transition pop; the floor pool below still reads as where the beam
    // lands.
    lengthFraction: 0.65,
    radialSegments: 24,
  },
  floorPool: {
    opacity: 0.22,
  },
  dust: {
    color: '#fff6e8',
    // Raised again from 230 (was 170 before that) — a significant density
    // increase per explicit request, still concentrated near the beam
    // origin by `topBias` below rather than spread evenly.
    count: 550,
    // Size now varies per point (see buildDust's aSize attribute) between
    // these two bounds instead of one fixed value: small/tight near the
    // top of the shaft, large/heavy near the floor and pillars.
    sizeSmall: 0.022,
    sizeLarge: 0.075,
    opacity: 0.4,
    // Exponent applied to the uniform random sample that picks each
    // point's position along the beam axis (0 = light source/top, 1 =
    // floor target). >1 skews the distribution toward 0 — see buildDust —
    // clustering particles near the top while still leaving a long, sparse
    // tail drifting down into the room, rather than a hard density cutoff.
    topBias: 2.4,
  },
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

  const beamLength = fullLength * params.beam.lengthFraction
  const radius = Math.tan(params.spot.angle) * beamLength

  const geometry = new THREE.ConeGeometry(radius, beamLength, params.beam.radialSegments, 1, true)
  // Apex defaults to local +height/2; shift so the apex sits at the local
  // origin and the (open) base trails off along local -Y.
  geometry.translate(0, -beamLength / 2, 0)

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(params.beam.color) },
      uOpacity: { value: params.beam.opacity },
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

/** A soft, analytic radial glow where the beam meets the floor. */
function buildFloorPool(params, origin, target) {
  const fullLength = target.clone().sub(origin).length()
  const radius = Math.tan(params.spot.angle) * fullLength * 0.6
  const geometry = new THREE.CircleGeometry(radius, 32)

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(params.beam.color) },
      uOpacity: { value: params.floorPool.opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float d = distance(vUv, vec2(0.5));
        float fade = 1.0 - smoothstep(0.12, 0.5, d);
        gl_FragColor = vec4(uColor, uOpacity * fade);
      }
    `,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(target.x, 0.02, target.z)
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
  const maxRadius = Math.tan(params.spot.angle) * fullLength

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

  let spotLight = null
  let spotTarget = null
  let keyLight = null
  let fillLight = null
  let ambientLight = null
  let beam = null
  let floorPool = null
  let dust = null

  function init() {
    const origin = new THREE.Vector3(...params.spot.position)
    const target = new THREE.Vector3(...params.spot.target)

    spotLight = new THREE.SpotLight(
      params.spot.color,
      params.spot.intensity,
      params.spot.distance,
      params.spot.angle,
      params.spot.penumbra,
      params.spot.decay,
    )
    spotLight.position.copy(origin)
    spotLight.castShadow = true
    spotLight.shadow.mapSize.set(params.shadow.mapSize, params.shadow.mapSize)
    spotLight.shadow.radius = params.shadow.radius
    spotLight.shadow.bias = params.shadow.bias
    spotLight.shadow.normalBias = params.shadow.normalBias
    spotLight.shadow.camera.near = 1
    spotLight.shadow.camera.far = params.spot.distance

    spotTarget = new THREE.Object3D()
    spotTarget.position.copy(target)
    spotLight.target = spotTarget

    // Stable directional fill — no shadow map of its own, so it can't
    // introduce a second source of shadow acne/strobing. Purely lifts the
    // room's general readability; the spot remains the only shadow caster
    // and the only thing that "looks like" the narrative light source.
    keyLight = new THREE.DirectionalLight(params.key.color, params.key.intensity)
    keyLight.position.set(...params.key.position)
    keyLight.castShadow = false

    fillLight = new THREE.DirectionalLight(params.fill.color, params.fill.intensity)
    fillLight.position.set(...params.fill.position)
    fillLight.castShadow = false

    ambientLight = new THREE.AmbientLight(params.ambient.color, params.ambient.intensity)

    beam = buildBeam(params, origin, target)
    floorPool = buildFloorPool(params, origin, target)
    dust = buildDust(params, origin, target)

    group.add(spotLight, spotTarget, keyLight, fillLight, ambientLight, beam, floorPool, dust)

    // Start fully dark — the ignition ramp (below) takes over from the
    // very first frame, but this avoids even a one-frame flash of full
    // brightness before that first `useFrame` call lands.
    setIgnition(0)
  }

  /**
   * Scroll-driven dark-to-light reveal: `factor` 0 = near-total darkness
   * (only `ambient.darkIntensity`'s faint edge-outlining tint), 1 = the
   * room's full established brightness. Scales every light's intensity
   * and every volumetric element's opacity proportionally from their
   * `lightingParams` values — not just the beam/dust (as an earlier,
   * now-superseded approach-fade did), since a real "ignition" needs the
   * spot, key, and fill lights themselves to visibly brighten too, not
   * just the atmospheric extras. Driven by a direct property mutation
   * from `VolumetricLightingRig`'s `useFrame`, not React state, per
   * technical-architecture.md §7.
   */
  function setIgnition(factor) {
    if (spotLight) spotLight.intensity = params.spot.intensity * factor
    if (keyLight) keyLight.intensity = params.key.intensity * factor
    if (fillLight) fillLight.intensity = params.fill.intensity * factor
    if (ambientLight) {
      ambientLight.intensity = THREE.MathUtils.lerp(params.ambient.darkIntensity, params.ambient.intensity, factor)
    }
    if (beam) beam.material.uniforms.uOpacity.value = params.beam.opacity * factor
    if (dust) dust.material.uniforms.uOpacity.value = params.dust.opacity * factor
    if (floorPool) floorPool.material.uniforms.uOpacity.value = params.floorPool.opacity * factor
  }

  /** Advances the dust field's GPU drift animation — see `buildDust`. */
  function setTime(t) {
    if (dust) dust.material.uniforms.uTime.value = t
  }

  function update() {
    // Still a no-op — scroll-coupling now happens through `setIgnition`
    // and `setTime`, called directly from `VolumetricLightingRig`'s
    // `useFrame`, not through this generic hook.
  }

  function dispose() {
    beam?.geometry.dispose()
    beam?.material.dispose()
    floorPool?.geometry.dispose()
    floorPool?.material.dispose()
    dust?.geometry.dispose()
    dust?.material.dispose()
    group.clear()
  }

  return { group, params, init, update, dispose, setIgnition, setTime }
}
