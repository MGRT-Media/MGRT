import * as THREE from 'three'
import { useLoader, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { SCANNED_BASE, SCANNED_SLOTS } from '../materials/scannedStone.js'
import { assetUrl } from '../assets/assetUrl.js'

/**
 * The Campaigns ground: asphalt on the road, earth along its shoulders and the
 * river banks, grass-covered ground everywhere else.
 *
 * The three sets follow the room's scanned-texture layout exactly —
 * `/textures/<set>/albedo|normal|orm.webp`, occlusion/roughness/metalness packed
 * in the ORM — so the same slot table describes them. They load through
 * `useLoader` rather than the room's non-suspending cache: the exterior already
 * mounts behind `CampaignsGate`'s Suspense boundary, on a held frame well before
 * the swap, which is exactly where a suspending load belongs.
 *
 * Each file is decoded and uploaded once. The terrain samples the textures
 * directly in world space; the road takes `clone()`s (which share the decoded
 * source) only because its maps are addressed through the standard material's
 * own UV slots.
 */
const GROUND_SETS = ['asphalt', 'earth', 'grass-hill']

const groundUrls = GROUND_SETS.flatMap((set) => SCANNED_SLOTS.map(({ file }) => assetUrl(`${SCANNED_BASE}/${set}/${file}`)))

/** World size of one texture tile, in metres, per set. */
export const GROUND_TILE = {
  // A lane width: the scan's aggregate then reads at road-surface scale
  // rather than as gravel or as a smooth slab.
  asphalt: 3.5,
  earth: 3.2,
  // Aerial ground cover rather than a close-up of grass blades, so it tiles
  // larger; a second, rotated and larger sampling breaks the repeat (below).
  grass: 7.5,
}

/** Tangent-space bump strength. The scans are close-range and read too deep across a landscape at full strength. */
const NORMAL_STRENGTH = { asphalt: 0.55, earth: 0.7, grass: 0.6 }

export function useGroundMaps() {
  const textures = useLoader(THREE.TextureLoader, groundUrls)
  const gl = useThree((state) => state.gl)

  return useMemo(() => {
    const sets = {}
    GROUND_SETS.forEach((set, setIndex) => {
      const maps = {}
      SCANNED_SLOTS.forEach(({ key, colorSpace }, slotIndex) => {
        const texture = textures[setIndex * SCANNED_SLOTS.length + slotIndex]
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        // Colour is sRGB; normal and ORM are measurements and stay linear.
        texture.colorSpace = colorSpace ?? THREE.NoColorSpace
        texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
        texture.needsUpdate = true
        // Uploaded now, on the held Digital frame this mounts on, rather than
        // on the first exterior frame — which is the swap itself.
        gl.initTexture(texture)
        maps[key] = texture
      })
      sets[set === 'grass-hill' ? 'grass' : set] = maps
    })
    return sets
  }, [textures, gl])
}

/**
 * Value noise and a three-octave sum, in world space. Cheap enough per pixel,
 * and deterministic, so the ground reads the same on every visit.
 */
const NOISE_GLSL = /* glsl */ `
  float groundHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float groundNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(groundHash(i), groundHash(i + vec2(1.0, 0.0)), u.x),
      mix(groundHash(i + vec2(0.0, 1.0)), groundHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float groundFbm(vec2 p) {
    return groundNoise(p) * 0.5 + groundNoise(p * 2.03 + 17.1) * 0.3 + groundNoise(p * 4.07 + 41.7) * 0.2;
  }
`

/**
 * Tangent-space normal onto a surface mapped in world X/Z.
 *
 * The planar mapping runs u along +X and v along -Z (the flip keeps the frame
 * right-handed against an upward normal, so bumps are not inverted). The frame
 * is re-orthogonalised against the interpolated normal, so it holds on the
 * sloped dunes and hills too.
 */
const PLANAR_NORMAL_GLSL = /* glsl */ `
  vec3 groundPerturb(vec3 surfaceNormal, vec3 tangentNormal) {
    vec3 t = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    t = normalize(t - surfaceNormal * dot(surfaceNormal, t));
    vec3 b = normalize(cross(surfaceNormal, t));
    return normalize(t * tangentNormal.x + b * tangentNormal.y + surfaceNormal * tangentNormal.z);
  }
`

/**
 * Where the earth strip along the road starts, measured from the centreline:
 * the carriageway's edge (7m). The strip is `EARTH_EDGE_WIDTH` wide before it
 * hands over to grass, then pushed in and out by noise so the boundary never
 * runs straight.
 */
const EARTH_EDGE_START = 7.3
const EARTH_EDGE_WIDTH = 3
const EARTH_EDGE_JITTER = 4
const RIVER_BANK_EARTH = 13

/**
 * The terrain material: grass ground cover blended into earth along the road
 * shoulders and river banks, with colour, roughness and surface detail all
 * following the same mask.
 *
 * A standard material with its three map slots replaced, so lighting, fog,
 * shadows and the sky's environment lighting all still come from Three. The
 * blend needs two per-vertex distances — to the road centreline and to the
 * river — which the terrain carries as attributes; everything else is world
 * space, so the ground mesh needs no UVs and the hills can share the material.
 *
 * Repetition is broken three ways: the grass is sampled twice at different,
 * rotated scales and mixed by low-frequency noise; a very large-scale noise
 * varies brightness across the landscape; and small noise-driven earth patches
 * appear in the open ground.
 */
export function createTerrainMaterial(maps) {
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uGrassMap: { value: maps.grass.map },
      uGrassNormal: { value: maps.grass.normalMap },
      uGrassOrm: { value: maps.grass.ormMap },
      uEarthMap: { value: maps.earth.map },
      uEarthNormal: { value: maps.earth.normalMap },
      uEarthOrm: { value: maps.earth.ormMap },
    })

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aRoadDistance;
        attribute float aRiverDistance;
        varying float vRoadDistance;
        varying float vRiverDistance;
        varying vec3 vGroundWorld;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vRoadDistance = aRoadDistance;
        vRiverDistance = aRiverDistance;
        vGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uGrassMap;
        uniform sampler2D uGrassNormal;
        uniform sampler2D uGrassOrm;
        uniform sampler2D uEarthMap;
        uniform sampler2D uEarthNormal;
        uniform sampler2D uEarthOrm;
        varying float vRoadDistance;
        varying float vRiverDistance;
        varying vec3 vGroundWorld;
        ${NOISE_GLSL}
        ${PLANAR_NORMAL_GLSL}
        const mat2 GRASS_ROTATION = mat2(0.8, -0.6, 0.6, 0.8);`,
      )
      .replace(
        '#include <map_fragment>',
        `
        vec2 groundXZ = vec2(vGroundWorld.x, -vGroundWorld.z);
        vec2 grassUvA = groundXZ / ${GROUND_TILE.grass.toFixed(2)};
        vec2 grassUvB = GRASS_ROTATION * groundXZ / ${(GROUND_TILE.grass * 2.7).toFixed(2)} + vec2(0.37, 0.71);
        float grassPick = smoothstep(0.32, 0.68, groundFbm(groundXZ * 0.021));
        vec2 earthUv = groundXZ / ${GROUND_TILE.earth.toFixed(2)};

        // Earth along the road: a strip starting at the asphalt's edge whose
        // outer boundary wanders by several metres at two scales, so it never
        // reads as a painted band. The same treatment, wider, on the banks.
        float edgeWander = (groundFbm(groundXZ * 0.08) - 0.5) * ${EARTH_EDGE_JITTER.toFixed(2)}
          + (groundNoise(groundXZ * 0.6) - 0.5) * 1.2;
        float roadEarth = 1.0 - smoothstep(
          ${EARTH_EDGE_START.toFixed(2)},
          ${(EARTH_EDGE_START + EARTH_EDGE_WIDTH).toFixed(2)},
          vRoadDistance + edgeWander
        );
        float riverEarth = 1.0 - smoothstep(${RIVER_BANK_EARTH.toFixed(2)}, ${(RIVER_BANK_EARTH + 7).toFixed(2)}, vRiverDistance + edgeWander);
        // Occasional small bare patches in the open ground, never solid.
        float earthPatches = smoothstep(0.74, 0.88, groundFbm(groundXZ * 0.06 + 9.3)) * 0.5;
        float groundEarth = clamp(max(max(roadEarth, riverEarth), earthPatches), 0.0, 1.0);

        vec3 grassColor = mix(texture2D(uGrassMap, grassUvA).rgb, texture2D(uGrassMap, grassUvB).rgb, grassPick);
        // Far away the eye finds the tile even through two samplings, so the
        // detail eases toward the scan's own average colour (measured off the
        // albedo) with distance; up close nothing changes.
        float groundFar = smoothstep(90.0, 260.0, distance(vGroundWorld, cameraPosition));
        grassColor = mix(grassColor, vec3(0.168, 0.122, 0.026), groundFar * 0.6);
        vec3 earthColor = texture2D(uEarthMap, earthUv).rgb;
        // Broad, gentle value variation across the landscape — enough that
        // the eye cannot find the tile, not enough to read as blotches.
        float groundMacro = mix(0.88, 1.08, groundFbm(groundXZ * 0.011 + 3.1));
        diffuseColor.rgb *= mix(grassColor, earthColor, groundEarth) * groundMacro;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `
        float grassRoughness = mix(texture2D(uGrassOrm, grassUvA).g, texture2D(uGrassOrm, grassUvB).g, grassPick);
        float roughnessFactor = roughness * mix(grassRoughness, texture2D(uEarthOrm, earthUv).g, groundEarth);
        `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `
        vec3 grassNormalA = texture2D(uGrassNormal, grassUvA).xyz * 2.0 - 1.0;
        vec3 grassNormalB = texture2D(uGrassNormal, grassUvB).xyz * 2.0 - 1.0;
        // Sample B was taken in a rotated frame; turn its slope back.
        grassNormalB.xy = transpose(GRASS_ROTATION) * grassNormalB.xy;
        vec3 grassNormal = mix(grassNormalA, grassNormalB, grassPick);
        grassNormal.xy *= ${NORMAL_STRENGTH.grass.toFixed(2)} * (1.0 - groundFar * 0.7);
        vec3 earthNormal = texture2D(uEarthNormal, earthUv).xyz * 2.0 - 1.0;
        earthNormal.xy *= ${NORMAL_STRENGTH.earth.toFixed(2)};
        normal = groundPerturb(normal, normalize(mix(grassNormal, earthNormal, groundEarth)));
        `,
      )
  }
  // One program for every mesh using this material, however many there are.
  material.customProgramCacheKey = () => 'campaigns-terrain'
  return material
}

/**
 * The asphalt: the scanned set on the road surface, with a little dirt carried
 * in from the shoulders along its outer edges.
 *
 * The road's UVs are in metres (`highway.js`'s `ribbonGeometry`) — u across,
 * from the centreline, and v along — so the tile size is a plain repeat, and
 * the dirt mask can use u directly as distance from the centreline.
 */
export function createAsphaltMaterial(maps, halfWidth) {
  const repeat = 1 / GROUND_TILE.asphalt
  const clone = (texture) => {
    const copy = texture.clone()
    copy.repeat.set(repeat, repeat)
    copy.needsUpdate = true
    return copy
  }
  const ormMap = clone(maps.asphalt.ormMap)
  // three reads aoMap from uv1 by default; the road carries one UV set.
  ormMap.channel = 0
  const material = new THREE.MeshStandardMaterial({
    map: clone(maps.asphalt.map),
    normalMap: clone(maps.asphalt.normalMap),
    normalScale: new THREE.Vector2(NORMAL_STRENGTH.asphalt, NORMAL_STRENGTH.asphalt),
    roughnessMap: ormMap,
    aoMap: ormMap,
    metalness: 0,
    roughness: 1,
    // The road lies a centimetre above the level ground under it; the offset
    // keeps it in front at distance, where depth precision cannot.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEarthMap = { value: maps.earth.map }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec2 vRoadMetres;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRoadMetres = uv;`)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uEarthMap;
        varying vec2 vRoadMetres;
        ${NOISE_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // Dirt near the edges only, and patchy along the road's length.
        float roadEdge = abs(vRoadMetres.x);
        float edgeDirt = smoothstep(${(halfWidth - 1.3).toFixed(2)}, ${halfWidth.toFixed(2)}, roadEdge + (groundNoise(vRoadMetres * vec2(1.4, 0.35)) - 0.5) * 0.9);
        edgeDirt *= mix(0.35, 0.75, groundFbm(vRoadMetres * vec2(0.3, 0.05)));
        vec3 dirt = texture2D(uEarthMap, vRoadMetres / ${GROUND_TILE.earth.toFixed(2)}).rgb;
        // Long-wavelength wear so the tile does not repeat down the road.
        float roadWear = mix(0.9, 1.08, groundFbm(vRoadMetres * vec2(0.18, 0.025) + 5.0));
        diffuseColor.rgb = mix(diffuseColor.rgb * roadWear, dirt, edgeDirt);`,
      )
  }
  material.customProgramCacheKey = () => 'campaigns-asphalt'
  return material
}
