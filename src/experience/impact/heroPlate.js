import * as THREE from 'three'

/**
 * The still of the hero frame that the Impact print carries.
 *
 * The print has to show the visitor EXACTLY the frame they were looking at a
 * moment earlier, at whatever viewport they are on, with the room's own
 * lighting, ambient occlusion and depth of field already in it. Nothing
 * authored offline can be that — the hero shot's stand-off and field are both
 * solved from the live aspect (`cameraPath.js`), so the frame is different on
 * every screen. So it is taken from the running frame instead.
 *
 * WHERE it is taken from matters. The post chain is
 *
 *     render -> GTAO -> bokeh -> dust -> output
 *
 * and this copies the buffer after BOKEH, which is the last pass whose result
 * is a plain linear image of the room. Displaying that on an unlit surface
 * puts the same linear values back into the same buffer, where the remaining
 * passes treat them exactly as they treated the original:
 *
 *  - `output` tone-maps and encodes them ONCE, as it did before, so the
 *    picture comes out identical rather than tone-mapped twice;
 *  - `dust` adds its grains once, live, on top — which is why the copy is
 *    taken before it rather than after, or the frame would carry two sets;
 *  - GTAO and bokeh re-run over a flat sheet square to the lens, where they
 *    have nothing to do: no occlusion, nothing out of focus.
 *
 * The texture is therefore linear data, not colour (`NoColorSpace`), and the
 * print's material must be unlit for as long as it is pretending to be the
 * room.
 */

const plateTarget = new THREE.WebGLRenderTarget(1, 1, {
  // Half float, not byte: the buffer being copied is linear and pre-exposure,
  // so its highlights — the brass, the shafts of light — run well past 1 and
  // an 8-bit copy would clip them flat before the tone mapping that is
  // supposed to roll them off.
  type: THREE.HalfFloatType,
  depthBuffer: false,
  stencilBuffer: false,
})
plateTarget.texture.colorSpace = THREE.NoColorSpace
plateTarget.texture.minFilter = THREE.LinearFilter
plateTarget.texture.magFilter = THREE.LinearFilter
plateTarget.texture.generateMipmaps = false

/** The still itself, for the print's material. */
export const heroPlateTexture = plateTarget.texture

/** True once a frame has actually been copied in — until then there is nothing to show. */
export const heroPlate = { captured: false, aspect: 1 }

let pending = false

/**
 * Asks for the next composed frame to be kept.
 *
 * Called on the frame the Impact move is about to start, while the camera is
 * still resting on the hero and the room is still the thing being drawn.
 */
export function requestHeroPlate() {
  pending = true
}

export function heroPlatePending() {
  return pending
}

const copyQuad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(tDiffuse, vUv);
      }
    `,
    depthTest: false,
    depthWrite: false,
  }),
)
const copyScene = new THREE.Scene().add(copyQuad)
const copyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

/**
 * Copies `source` into the plate, if one has been asked for.
 *
 * A straight blit through a pass-through shader rather than a texture copy:
 * the source is a multisampled composer target, and resolving it is exactly
 * what drawing from it does.
 */
export function captureHeroPlate(renderer, source) {
  if (!pending) return
  pending = false

  const { width, height } = source
  if (plateTarget.width !== width || plateTarget.height !== height) plateTarget.setSize(width, height)

  const previousTarget = renderer.getRenderTarget()
  copyQuad.material.uniforms.tDiffuse.value = source.texture
  renderer.setRenderTarget(plateTarget)
  renderer.render(copyScene, copyCamera)
  renderer.setRenderTarget(previousTarget)

  heroPlate.captured = true
  heroPlate.aspect = width / height
}
