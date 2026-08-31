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
  penumbra: 0.92,
  decay: 1.8,
  distance: 24,
  shadow: {
    mapSize: 2048,
    radius: 6,
    bias: -0.0012,
  },
  ambient: {
    color: '#9a9aa2',
    intensity: 1.1,
  },
  fog: {
    color: '#08080a',
    density: 0.05,
  },
  volumetric: {
    color: '#fff1dc',
    opacity: 0.055,
    coreOpacity: 0.12,
    coreScale: 0.42,
    radialSegments: 32,
  },
  dust: {
    color: '#fff6e8',
    count: 170,
    size: 0.035,
    opacity: 0.4,
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
 * Builds one shaft "shell" mesh (a cone whose opacity fades in near the
 * source and out near the floor). Used twice — a narrow, brighter "core"
 * and a wider, softer "halo" — so the overlapping shells and the
 * view-angle (fresnel) term below give the beam a sense of physical
 * volume and depth without raymarching or a depth-texture pass.
 */
function buildShaftShell(params, origin, target, { radiusScale, opacity }) {
  const axis = new THREE.Vector3().subVectors(target, origin)
  const length = axis.length()
  axis.normalize()

  const radiusBottom = Math.tan(params.angle) * length * radiusScale

  const geometry = new THREE.ConeGeometry(radiusBottom, length, params.volumetric.radialSegments, 1, true)

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(params.volumetric.color) },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      varying float vT;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        // Cone spans local Y in [-length/2, +length/2]; apex (+Y) sits at
        // the light source, base (-Y) sits at the target. vT: 0 at the
        // source, 1 at the target.
        vT = clamp(0.5 - (position.y / ${length.toFixed(6)}), 0.0, 1.0);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vT;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        float lengthFade = smoothstep(0.0, 0.12, vT) * (1.0 - smoothstep(0.82, 1.0, vT));
        // Grazing angles (the beam's silhouette, as seen from the camera)
        // read as denser — the classic cheap stand-in for "more atmosphere
        // along this view ray" that gives a flat shell a sense of volume.
        float fresnel = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDir))), 2.0);
        float density = mix(0.4, 1.0, fresnel);
        gl_FragColor = vec4(uColor, uOpacity * lengthFade * density);
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

/**
 * The visible light shaft: a narrow brighter "core" nested inside a wider
 * softer "halo" shell, so the beam reads as a volume rather than a single
 * flat translucent surface.
 */
function buildVolumetricShaft(params, origin, target) {
  const halo = buildShaftShell(params, origin, target, {
    radiusScale: 1,
    opacity: params.volumetric.opacity,
  })
  const core = buildShaftShell(params, origin, target, {
    radiusScale: params.volumetric.coreScale,
    opacity: params.volumetric.coreOpacity,
  })

  const group = new THREE.Group()
  group.add(halo.mesh, core.mesh)

  return { mesh: group, length: halo.length, meshes: [halo.mesh, core.mesh] }
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
  let shaftMeshes = []
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
    spotLight.shadow.mapSize.set(params.shadow.mapSize, params.shadow.mapSize)
    spotLight.shadow.radius = params.shadow.radius
    spotLight.shadow.bias = params.shadow.bias
    spotLight.shadow.camera.near = 1
    spotLight.shadow.camera.far = params.distance

    spotTarget = new THREE.Object3D()
    spotTarget.position.copy(target)
    spotLight.target = spotTarget

    ambientLight = new THREE.AmbientLight(params.ambient.color, params.ambient.intensity)

    const { mesh: shaftGroup, length, meshes } = buildVolumetricShaft(params, origin, target)
    shaft = shaftGroup
    shaftMeshes = meshes

    floorPool = buildFloorPool(params, length, target)
    dust = buildDust(params, origin, target, length)

    group.add(spotLight, spotTarget, ambientLight, shaft, floorPool, dust)
  }

  function update(/* time */) {
    // Reserved for Phase 1C. Phase 1B lighting is static — nothing here
    // runs per frame yet.
  }

  function dispose() {
    shaftMeshes.forEach((mesh) => {
      mesh.geometry.dispose()
      mesh.material.dispose()
    })
    floorPool?.geometry.dispose()
    floorPool?.material.dispose()
    dust?.geometry.dispose()
    dust?.material.dispose()
    group.clear()
  }

  return { group, params, init, update, dispose }
}
