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
    position: [3.4, 8, 2.2],
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
    // linearly along the beam from 8 (source) to 0 (floor target), so
    // lengthFraction 0.75 stops the mesh at world Y ≈ 2.0 — a margin
    // above every camera height in cameraPath.js (max ~1.7), so the
    // camera can never end up inside this geometry, by construction,
    // regardless of how the camera path is tuned later. No scroll-
    // coupling needed to avoid a transition pop; the floor pool below
    // still reads as where the beam lands, and this keeps most of the
    // beam's dramatic visible length (unlike a more conservative
    // truncation, which pushed the whole mesh out of the hero shot's
    // frustum — checked and rejected during tuning).
    lengthFraction: 0.75,
    radialSegments: 24,
  },
  floorPool: {
    opacity: 0.22,
  },
  dust: {
    color: '#fff6e8',
    count: 170,
    size: 0.035,
    opacity: 0.4,
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
 * A small, static dust field confined to the full beam volume (origin to
 * floor target — dust can sit lower than the visible beam mesh itself,
 * since individual points don't create the "camera inside a shell" issue
 * a hollow cone does). Positions are generated once; no per-frame motion.
 */
function buildDust(params, origin, target) {
  const { count, size, color, opacity } = params.dust
  const fullLength = target.clone().sub(origin).length()
  const axis = target.clone().sub(origin).normalize()
  const { u, v } = buildRadialBasis(axis)
  const maxRadius = Math.tan(params.spot.angle) * fullLength

  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const t = Math.random()
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
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    color,
    size,
    opacity,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
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

  return { group, params, init, update, dispose }
}
