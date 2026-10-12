import * as THREE from 'three'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { circleOfConfusionGLSL } from './depthOfFieldShared.js'

/*
 * The lens, separated from any one scene's idea of what is in focus: a scene
 * decides the focus DISTANCE each frame and calls `setFocus`; everything about
 * how that distance becomes blur lives here.
 */

// Blur ramps with distance from the focal plane at this rate, and is capped
// here. `maxblur` is in UV units (fractions of frame width).
//
// 0.0009 / 0.0055 -> 0.00025 / 0.0016, per explicit direction that the blur was
// too strong and should be "very subtle, minimal": the room should read as
// mostly sharp, with only a restrained softening away from the subject. The
// ceiling is now 0.16% of frame width — about 3px on a 1920px-wide frame — and
// a wide shot's far wall stays well under it.
const APERTURE = 0.00025
const MAX_BLUR = 0.0016

// The sharp zone around the focal plane, as a fraction of the focus distance
// (a real lens's depth of field grows with focus distance too), clamped so a
// close-up still has a thin one and a wide shot does not become all sharp.
// With no band at all, blur began the instant anything left the focal plane,
// so even the subject's own depth — a column's far side, the monitor's plinth
// — was softening. See `circleOfConfusion` for how the band's edge is eased.
const FOCUS_RANGE_FRACTION = 0.4
const FOCUS_RANGE_MIN = 0.05
const FOCUS_RANGE_MAX = 3

// A real camera does not hold one stop across a whole sequence. A wide
// establishing shot is stopped down so the set reads; the operator opens up
// again for the close-up, where shallow focus is the point. `APERTURE` above
// was authored for the close-ups and, held flat, it was also being applied to
// the wide orbit — where the focal plane sits on the room's subject ~8.6 away
// while the pillar ring stands at 3.5. That 5.1-unit gap put the colonnade at
// ~84% of `MAX_BLUR`: the architecture, which is what the wide shot is of, was
// the least readable thing in it.
//
// So the stop tracks the focus distance. At or inside `SHALLOW_FOCUS_DISTANCE`
// the aperture is untouched, which keeps every close-up beat (focus 0.17-1.8,
// t 0.2-0.6) exactly as authored. Beyond it the stop closes off as 1/distance,
// deepening the field just as a real focus puller would for a wide.
// `MIN_APERTURE_SCALE` floors it so the effect never switches off entirely,
// which keeps a restrained separation between the subject and the far wall.
//
// `MAX_BLUR` is deliberately not scaled: it is the ceiling the close-ups are
// calibrated against, and at the reduced wide-shot stop nothing in the room is
// deep enough to reach it anyway.
const SHALLOW_FOCUS_DISTANCE = 2.4
const MIN_APERTURE_SCALE = 0.15

/**
 * The stock bokeh pass, with the two things that made the opening shot's blur
 * look wrong fixed.
 *
 * **Its depth.** BokehPass renders its own depth by drawing the whole scene
 * with one override material — so every object writes depth, including the
 * ones that write none when the frame is actually drawn. The sun shaft is the
 * big one: an additive, near-invisible prism whose flat walls cross most of the
 * room. In the depth buffer those walls were solid, so the blur of everything
 * behind them was decided by a surface no one can see, and each wall's
 * straight edge became a straight line across the frame where the blur
 * changed. Measured at the opening frame they covered 40% of it — at progress
 * 0, where the shaft's opacity is zero. Objects that do not write depth (the
 * shaft, the sky dome, glass) are now hidden for the depth render only, so the
 * blur follows the geometry that is really there.
 *
 * **Its gather.** The stock shader blurs a pixel by averaging 41 samples in
 * fixed rings, with no idea what depth those samples come from. Where a sharp
 * column stands in front of a soft wall, the wall's pixels average the column
 * into themselves — a halo — and the rings show as bands at larger radii. The
 * replacement samples a rotated spiral, dithered per pixel so it has no
 * rings, and rejects samples that are nearer and sharper than the pixel being
 * blurred, so in-focus geometry does not bleed into the blur behind it. The
 * blur itself uses `circleOfConfusion`, which eases onto its ceiling rather
 * than hitting it, so there is no contour where a surface reaches maximum blur.
 */
const BOKEH_TAPS = 28

export default class DepthAwareBokehPass extends BokehPass {
  constructor(scene, camera) {
    super(scene, camera, { focus: 5, aperture: APERTURE, maxblur: MAX_BLUR })
    this.hiddenForDepth = []
    this.materialBokeh.fragmentShader = /* glsl */ `
      #include <common>
      #include <packing>
      ${circleOfConfusionGLSL}
      varying vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform float maxblur;
      uniform float aperture;
      uniform float nearClip;
      uniform float farClip;
      uniform float focus;
      uniform float focusRange;
      uniform float aspect;

      float viewZAt( const in vec2 uv ) {
        return perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, uv ) ), nearClip, farClip );
      }

      void main() {
        vec3 centre = texture2D( tColor, vUv ).rgb;
        float centreZ = viewZAt( vUv );
        float radius = abs( circleOfConfusion( centreZ, focus, aperture, maxblur, focusRange ) );
        if ( radius < 1e-5 ) {
          gl_FragColor = vec4( centre, 1.0 );
          return;
        }

        // Interleaved gradient noise rotates the spiral per pixel.
        float rotation = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
        vec3 sum = centre;
        float weightSum = 1.0;
        for ( int i = 0; i < ${BOKEH_TAPS}; i++ ) {
          float fi = float( i ) + 0.5;
          float r = sqrt( fi / ${BOKEH_TAPS}.0 ) * radius;
          float theta = fi * 2.3999632 + rotation;
          vec2 uv = vUv + vec2( cos( theta ), sin( theta ) * aspect ) * r;
          float sampleZ = viewZAt( uv );
          // A sample nearer than this pixel may only contribute as far as its
          // own blur reaches; a sharp column in front stays out of the wall's
          // blur behind it.
          float nearer = smoothstep( 0.05, 0.3, sampleZ - centreZ );
          float reach = smoothstep( r * 0.5, r, abs( circleOfConfusion( sampleZ, focus, aperture, maxblur, focusRange ) ) );
          float weight = mix( 1.0, reach, nearer );
          sum += texture2D( tColor, uv ).rgb * weight;
          weightSum += weight;
        }
        gl_FragColor = vec4( sum / weightSum, 1.0 );
      }
    `
    this.materialBokeh.uniforms.focusRange = { value: 0 }
    this.materialBokeh.needsUpdate = true
  }

  /**
   * Puts the focal plane at `distance` and sets the stop to match — see
   * `SHALLOW_FOCUS_DISTANCE`: stopped down as the subject gets further away,
   * so wide shots hold the room and close-ups stay shallow.
   */
  setFocus(distance, camera) {
    const uniforms = this.uniforms
    const apertureScale = THREE.MathUtils.clamp(
      SHALLOW_FOCUS_DISTANCE / Math.max(distance, 0.0001),
      MIN_APERTURE_SCALE,
      1,
    )
    uniforms.focus.value = distance
    uniforms.aperture.value = APERTURE * apertureScale
    uniforms.maxblur.value = MAX_BLUR
    uniforms.focusRange.value = THREE.MathUtils.clamp(distance * FOCUS_RANGE_FRACTION, FOCUS_RANGE_MIN, FOCUS_RANGE_MAX)
    // The bokeh shader linearises depth against the camera's own clip planes,
    // read live so they can never go stale against the camera.
    uniforms.nearClip.value = camera.near
    uniforms.farClip.value = camera.far
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    const hidden = this.hiddenForDepth
    hidden.length = 0
    this.scene.traverseVisible((object) => {
      const material = object.material
      if (material && !Array.isArray(material) && material.depthWrite === false) hidden.push(object)
    })
    for (const object of hidden) object.visible = false
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive)
    for (const object of hidden) object.visible = true
  }
}
