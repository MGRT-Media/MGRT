import * as THREE from 'three'

/**
 * Phase 1B baseline lighting parameters — the single source of truth for
 * the primary cinematic light. Exposed as plain data so Phase 1C can bind
 * scroll-driven interpolation to these values without touching this
 * module's internals. Phase 1B itself never mutates these at runtime.
 */
export const lightingParams = {
  color: '#fff1dc',
  intensity: 55,
  position: [3.4, 8, 2.2],
  target: [0.6, 0, -3.5],
  angle: 0.32,
  penumbra: 0.65,
  decay: 1.8,
  distance: 24,
  ambient: {
    color: '#9a9aa2',
    intensity: 0.85,
  },
  volumetric: {
    color: '#fff1dc',
    opacity: 0.06,
    radialSegments: 24,
  },
  dust: {
    color: '#fff6e8',
    count: 140,
    size: 0.035,
    opacity: 0.35,
  },
}

/** Perpendicular basis for offsetting points around the shaft's own axis. */
function buildRadialBasis(axis) {
  const arbitrary = Math.abs(axis.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const u = new THREE.Vector3().crossVectors(axis, arbitrary).normalize()
  const v = new THREE.Vector3().crossVectors(axis, u).normalize()
  return { u, v }
}

/**
 * The visible light shaft: a single additive-blended cone whose opacity
 * fades in near the source and out near the floor, so it reads as a soft
 * volumetric beam rather than a hard-edged solid. No post-processing or
 * raymarching — one mesh, one draw call.
 */
function buildVolumetricShaft(params, origin, target) {
  const axis = new THREE.Vector3().subVectors(target, origin)
  const length = axis.length()
  axis.normalize()

  const radiusBottom = Math.tan(params.angle) * length

  const geometry = new THREE.ConeGeometry(radiusBottom, length, params.volumetric.radialSegments, 1, true)

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(params.volumetric.color) },
      uOpacity: { value: params.volumetric.opacity },
    },
    vertexShader: /* glsl */ `
      varying float vT;
      void main() {
        // Cone spans local Y in [-length/2, +length/2]; apex (+Y) sits at
        // the light source, base (-Y) sits at the target. vT: 0 at the
        // source, 1 at the target.
        vT = clamp(0.5 - (position.y / ${length.toFixed(6)}), 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vT;
      void main() {
        float fade = smoothstep(0.0, 0.12, vT) * (1.0 - smoothstep(0.82, 1.0, vT));
        gl_FragColor = vec4(uColor, uOpacity * fade);
      }
    `,
  })

  const mesh = new THREE.Mesh(geometry, material)

  const midpoint = origin.clone().add(target).multiplyScalar(0.5)
  const dirToOrigin = origin.clone().sub(target).normalize()
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirToOrigin)
  mesh.position.copy(midpoint)

  return { mesh, length }
}

/** A soft, analytic radial glow where the beam meets the floor. */
function buildFloorPool(params, length, target) {
  const radius = Math.tan(params.angle) * length * 0.6
  const geometry = new THREE.CircleGeometry(radius, 32)

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(params.volumetric.color) },
      uOpacity: { value: params.volumetric.opacity * 1.4 },
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
 * A small, static dust field confined to the shaft volume. Positions are
 * generated once (no per-frame motion) — Phase 1B lighting is static by
 * requirement, and restrained per creative-reference.md §10.
 */
function buildDust(params, origin, target, length) {
  const { count, size, color, opacity } = params.dust
  const axis = new THREE.Vector3().subVectors(target, origin).normalize()
  const { u, v } = buildRadialBasis(axis)
  const maxRadius = Math.tan(params.angle) * length

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
 * Framework-agnostic controller for the Phase 1B volumetric lighting
 * system. `update(time)` is intentionally a no-op placeholder in this
 * phase — it exists so Phase 1C can drive these values from the shared
 * cinematic timeline without a rewrite, but nothing should call it yet.
 */
export function createVolumetricLighting(params = lightingParams) {
  const group = new THREE.Group()
  group.name = 'VolumetricLighting'

  let spotLight = null
  let spotTarget = null
  let ambientLight = null
  let shaft = null
  let floorPool = null
  let dust = null

  function init() {
    const origin = new THREE.Vector3(...params.position)
    const target = new THREE.Vector3(...params.target)

    spotLight = new THREE.SpotLight(
      params.color,
      params.intensity,
      params.distance,
      params.angle,
      params.penumbra,
      params.decay,
    )
    spotLight.position.copy(origin)
    spotLight.castShadow = true
    spotLight.shadow.mapSize.set(1024, 1024)
    spotLight.shadow.bias = -0.0015
    spotLight.shadow.camera.near = 1
    spotLight.shadow.camera.far = params.distance

    spotTarget = new THREE.Object3D()
    spotTarget.position.copy(target)
    spotLight.target = spotTarget

    ambientLight = new THREE.AmbientLight(params.ambient.color, params.ambient.intensity)

    const { mesh: shaftMesh, length } = buildVolumetricShaft(params, origin, target)
    shaft = shaftMesh

    floorPool = buildFloorPool(params, length, target)
    dust = buildDust(params, origin, target, length)

    group.add(spotLight, spotTarget, ambientLight, shaft, floorPool, dust)
  }

  function update(/* time */) {
    // Reserved for Phase 1C. Phase 1B lighting is static — nothing here
    // runs per frame yet.
  }

  function dispose() {
    shaft?.geometry.dispose()
    shaft?.material.dispose()
    floorPool?.geometry.dispose()
    floorPool?.material.dispose()
    dust?.geometry.dispose()
    dust?.material.dispose()
    group.clear()
  }

  return { group, params, init, update, dispose }
}
