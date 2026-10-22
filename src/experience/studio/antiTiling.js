import * as THREE from 'three'

/**
 * Breaks up the visible repeat of a tiled texture.
 *
 * A scanned surface repeats every tile, and a wall many tiles wide shows the
 * same stains in a grid. This patches a standard material so each of its maps
 * is read twice, from two of eight fixed offsets into the scan, chosen and
 * blended by a slow noise across the surface (after Inigo Quilez's "texture
 * repetition", technique 3). Neighbouring patches of wall therefore come from
 * different parts of the scan, with soft transitions between them and no grid.
 *
 * Every map is shifted the same way at the same point, so colour, relief and
 * roughness stay in register. Offsets only, never rotation, so a normal map
 * stays valid.
 *
 * The cost is a second texture read per map and a few lines of noise. The
 * shader is patched before the material's first compile, so nothing is
 * recompiled later.
 */
const NO_TILE_GLSL = /* glsl */ `
  uniform float uNoTileScale;

  float noTileHash( vec2 p ) {
    return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
  }

  float noTileNoise( vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
    vec2 u = f * f * ( 3.0 - 2.0 * f );
    return mix(
      mix( noTileHash( i ), noTileHash( i + vec2( 1.0, 0.0 ) ), u.x ),
      mix( noTileHash( i + vec2( 0.0, 1.0 ) ), noTileHash( i + vec2( 1.0, 1.0 ) ), u.x ),
      u.y
    );
  }

  vec4 noTile( sampler2D samp, vec2 uv ) {
    // Which of eight offsets this point uses, and how far it is toward the next.
    float level = noTileNoise( uv * uNoTileScale ) * 8.0;
    float a = floor( level );
    vec2 offsetA = sin( vec2( 3.0, 7.0 ) * a );
    vec2 offsetB = sin( vec2( 3.0, 7.0 ) * ( a + 1.0 ) );
    // Gradients of the unshifted coordinates, so the jump between offsets does
    // not throw the mip level.
    vec2 dx = dFdx( uv );
    vec2 dy = dFdy( uv );
    return mix(
      textureGrad( samp, uv + offsetA, dx, dy ),
      textureGrad( samp, uv + offsetB, dx, dy ),
      smoothstep( 0.25, 0.75, fract( level ) )
    );
  }
`

const CHUNKS = [
  ['map_fragment', 'texture2D( map, vMapUv )', 'noTile( map, vMapUv )'],
  ['normal_fragment_maps', 'texture2D( normalMap, vNormalMapUv )', 'noTile( normalMap, vNormalMapUv )'],
  ['roughnessmap_fragment', 'texture2D( roughnessMap, vRoughnessMapUv )', 'noTile( roughnessMap, vRoughnessMapUv )'],
]

/**
 * `scale` is how many noise cells fall in one texture repeat: below 1, each
 * patch of a single offset spans more than one tile.
 */
export function breakUpTiling(material, scale) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNoTileScale = { value: scale }
    let fragment = shader.fragmentShader.replace('#include <common>', `#include <common>\n${NO_TILE_GLSL}`)
    for (const [chunk, from, to] of CHUNKS) {
      fragment = fragment.replace(`#include <${chunk}>`, THREE.ShaderChunk[chunk].replaceAll(from, to))
    }
    shader.fragmentShader = fragment
  }
  // Keeps the patched program apart from an unpatched one with the same maps.
  material.customProgramCacheKey = () => `no-tile-${scale}`
  return material
}
