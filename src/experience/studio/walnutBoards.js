import * as THREE from 'three'
import { LOOK } from './studioLook.js'
import { TABLE } from './studioLayout.js'

/**
 * Makes the walnut tabletop read as glued-up boards rather than one sheet.
 *
 * The top is one smooth slab (`studioGeometry.js`), so that its eased edges
 * and rounded corners are continuous. The boards are therefore drawn in the
 * shader instead of modelled: from each point's position on the table, it
 * works out which board that is and, on a jointed board, which of its two
 * lengths, then gives that length its own stretch of the scan, its own tone
 * and its own sheen (`LOOK.walnut`). Where two lengths meet the grain changes
 * abruptly, which is the glue line.
 *
 * Position is used rather than UVs so the front and back edges take the
 * board they belong to, and the grain runs over the eased edge unbroken. Only
 * the top is affected; the legs and rails carry their own variation.
 *
 * Patched before the material's first compile, so nothing recompiles later.
 */
const BOARD_GLSL = /* glsl */ `
  varying vec3 vTablePosition;

  float boardHash( float n ) {
    return fract( sin( n * 91.3458 ) * 47453.5453 );
  }

  vec2 walnutShift;
  float walnutTone;
  float walnutRoughness;

  void walnutBoard() {
    walnutShift = vec2( 0.0 );
    walnutTone = 1.0;
    walnutRoughness = 1.0;
    if ( vTablePosition.y < ${(TABLE.height - TABLE.topThickness - 0.002).toFixed(4)} ) return;
    float board = clamp(
      floor( ( vTablePosition.z / ${TABLE.depth.toFixed(4)} + 0.5 ) * ${LOOK.walnut.boards.toFixed(1)} ),
      0.0,
      ${(LOOK.walnut.boards - 1).toFixed(1)}
    );
    // Every other board is two lengths, butted somewhere in its middle.
    float joint = mix( -${LOOK.walnut.jointRange.toFixed(3)}, ${LOOK.walnut.jointRange.toFixed(3)}, boardHash( board + 0.37 ) );
    float piece = board * 2.0 + ( mod( board, 2.0 ) > 0.5 && vTablePosition.x > joint ? 1.0 : 0.0 );
    walnutShift = vec2( boardHash( piece + 0.11 ), boardHash( piece + 0.53 ) ) * 7.0;
    walnutTone = mix( ${LOOK.walnut.boardTone[0].toFixed(3)}, ${LOOK.walnut.boardTone[1].toFixed(3)}, boardHash( piece + 0.71 ) );
    walnutRoughness = mix( ${LOOK.walnut.boardRoughness[0].toFixed(3)}, ${LOOK.walnut.boardRoughness[1].toFixed(3)}, boardHash( piece + 0.29 ) );
  }

  // Shifted, with the gradients of the unshifted coordinates so the jump
  // between boards does not throw the mip level.
  vec4 walnutSample( sampler2D samp, vec2 uv ) {
    return textureGrad( samp, uv + walnutShift, dFdx( uv ), dFdy( uv ) );
  }
`

export function applyWalnutBoards(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTablePosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTablePosition = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${BOARD_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `walnutBoard();
#ifdef USE_MAP
  diffuseColor *= walnutSample( map, vMapUv );
#endif
  diffuseColor.rgb *= walnutTone;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  roughnessFactor *= walnutSample( roughnessMap, vRoughnessMapUv ).g;
#endif
  roughnessFactor *= walnutRoughness;`,
      )
      // The normal map is read through the same shift, so relief follows grain.
      .replace(
        '#include <normal_fragment_maps>',
        THREE.ShaderChunk.normal_fragment_maps.replaceAll(
          'texture2D( normalMap, vNormalMapUv )',
          'walnutSample( normalMap, vNormalMapUv )',
        ),
      )
  }
  material.customProgramCacheKey = () => 'walnut-boards'
  return material
}
