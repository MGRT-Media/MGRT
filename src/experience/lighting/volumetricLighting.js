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
    // (`Environment.jsx`'s `Window`, right side wall, x: +7) so the beam
    // visually originates at the window rather than an unmarked point in
    // space — "key light streams directly through the windows." `target`
    // is intentionally unchanged: `Monitor.jsx`'s `MONITOR_ANCHOR.position`
    // and therefore the entire camera path's monitor-aligned endpoint
    // (`cameraPath.js`) are both derived from this exact point, so moving
    // it would silently relocate the monitor and the whole scroll
    // destination — a much bigger change than "reposition the light."
    position: [6.85, 6.3, -3],
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
  ambient: {
    color: '#adadb8',
    intensity: 2.3,
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
    // Raised from 170 — the extra points are concentrated near the beam
    // origin by `topBias` below, not spread evenly, so this reads as
    // "more dust near the light" rather than a generally denser field.
    count: 230,
    size: 0.035,
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
 */
function buildDust(params, origin, target) {
  const { count, size, color, opacity, topBias } = params.dust
  const fullLength = target.clone().sub(origin).length()
  const axis = target.clone().sub(origin).normalize()
  const { u, v } = buildRadialBasis(axis)
  const maxRadius = Math.tan(params.spot.angle) * fullLength

  const positions = new Float32Array(count * 3)
  // A per-point random phase offset so points don't oscillate in lockstep
  // (which would read as the whole field pulsing rather than individual
  // specks drifting independently).
  const phases = new Float32Array(count)
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
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uSize: { value: size },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSize;
      attribute float aPhase;
      void main() {
        // Cinematic air-current drift — slow, small-amplitude, and
        // self-bounded (a sine/cosine wobble around the base position,
        // never a cumulative drift), so points stay put on screen and
        // simply breathe in place rather than traveling anywhere.
        vec3 pos = position;
        pos.x += sin(uTime * 0.3 + position.y + aPhase) * 0.05;
        pos.y += cos(uTime * 0.2 + position.x + aPhase) * 0.03;
        pos.z += sin(uTime * 0.25 + position.z + aPhase) * 0.04;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        // Perspective size attenuation, matching THREE.PointsMaterial's
        // own approach (size shrinks with distance from camera).
        gl_PointSize = uSize * (400.0 / -mvPosition.z);
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
 * Framework-agnostic controller for the room's lighting. Fully static:
 * `update()` is a no-op reserved for a future phase's scroll-driven
 * timeline, and nothing currently calls it — no scroll-coupling of any
 * kind lives in this module. The beam's geometry (not a runtime fade) is
 * what keeps the Phase 1C/1D camera transition free of a lighting pop;
 * see `beam.lengthFraction` above.
 */
export function createVolumetricLighting(params = lightingParams) {
  const group = new THREE.Group()
  group.name = 'VolumetricLighting'

  let spotLight = null
  let spotTarget = null
  let keyLight = null
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

    ambientLight = new THREE.AmbientLight(params.ambient.color, params.ambient.intensity)

    beam = buildBeam(params, origin, target)
    floorPool = buildFloorPool(params, origin, target)
    dust = buildDust(params, origin, target)

    group.add(spotLight, spotTarget, keyLight, ambientLight, beam, floorPool, dust)
  }

  /**
   * Fades the beam and dust (not the floor pool, which is flat on the
   * ground and never near the camera) toward fully transparent as the
   * camera approaches the monitor. The beam is an open, double-sided,
   * additive cone the camera's view direction passes close to during the
   * approach — around scroll progress 0.30–0.42, well before the camera
   * itself ever enters the geometry (the beam is truncated to stay above
   * every camera height, see `beam.lengthFraction` above). Driven by a
   * direct uniform/opacity mutation from `VolumetricLightingRig`'s
   * `useFrame`, not React state, per technical-architecture.md §7.
   */
  function setApproachFade(fade) {
    if (beam) beam.material.uniforms.uOpacity.value = params.beam.opacity * fade
    if (dust) dust.material.uniforms.uOpacity.value = params.dust.opacity * fade
  }

  /** Advances the dust field's GPU drift animation — see `buildDust`. */
  function setTime(t) {
    if (dust) dust.material.uniforms.uTime.value = t
  }

  function update() {
    // Reserved for a future scroll-driven timeline. Nothing runs here —
    // this lighting system is fully static by design.
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

  return { group, params, init, update, dispose, setApproachFade, setTime }
}
