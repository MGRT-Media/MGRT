import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js'
import { captureHeroPlate } from '../impact/heroPlate.js'
import { stage as impactStage } from '../impact/impactStage.js'
import { stageSwap } from '../impact/stageSwap.js'
import { HERO_LOOKAT } from '../timeline/cameraPath.js'
import { contentValue } from '../timeline/contentProgress.js'
import { HERO_T } from '../timeline/filmActBeats.js'
import { CAMERA_ANCHOR } from '../film/CinemaCamera.jsx'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'
import { PILLAR_RING_CENTER, PILLAR_RING_RADIUS } from '../Environment.jsx'
import { dustScene } from '../lighting/volumetricLighting.js'
import { circleOfConfusionGLSL, depthOfFieldUniforms } from './depthOfFieldShared.js'

/**
 * Depth of field, and the post-processing chain it owns: scene, contact
 * occlusion, the blur, airborne dust composited after it, then output.
 *
 * **Focus is not a parameter, it is the shot.** The focal plane is put on
 * the room's two real subjects — the Cinema Camera's lens and the
 * Monitor's screen — using the anchors those components already export,
 * rather than on a number authored per beat. Whichever is nearer the
 * camera is the one in focus, which is correct by construction: the whole
 * journey is a move from one to the other, and the shot is only ever
 * about the one it has arrived at.
 *
 * The path's own `lookAt` was the obvious candidate and is WRONG, which is
 * worth recording because it looks right. It is a direction marker, not a
 * subject: measured along the real path it sits 0.17 ahead of the camera
 * at the Film beat and a fixed 0.67 ahead for the whole of Digital.
 * Focusing there would have put the focal plane inside the
 * camera's own near field and thrown the entire room out of focus at every
 * beat after t = 0.45.
 *
 * Because the camera is damped and the anchors are fixed, focus trails the
 * move slightly on its own — which is what a real focus puller does.
 *
 * `FOCUS_DAMP_LAMBDA` adds a second, deliberate lag on top of that. Without
 * it, focus would be exact at every instant, and a cut-speed chapter jump
 * would rack focus instantly across the room — the one thing that reads as
 * a software effect rather than a lens.
 *
 * **Deliberately gentle.** `creative-reference.md` §4A's brief was explicit
 * that this must not become aggressive depth of field, and §4's Don't list
 * rules out effects that draw attention to the animation system. The
 * aperture and blur ceiling below are set so the subject is clean and the
 * far architecture softens — enough to separate foreground from background,
 * not enough to be the point.
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
 * Where the focal plane sits before the camera has entered the colonnade.
 *
 * Outside the ring the shot is not yet about the props — the camera is still
 * approaching, looking in through the columns, and the columns are what the
 * frame is made of. So focus rides the near arc of the ring and the interior
 * beyond it, props included, falls off; the rack onto the subject happens as
 * the camera passes between the pillars, which is where the shot actually
 * changes what it is about.
 *
 * Keyed off the camera's radius from `PILLAR_RING_CENTER` rather than scroll
 * progress, so it stays correct no matter how the path is re-timed later.
 *
 * The band straddles the ring: fully pillar-focused a couple of units out,
 * fully subject-focused just inside, with `FOCUS_DAMP_LAMBDA` smoothing the
 * hand-over into a rack rather than a switch.
 */
const RING_FOCUS_OUTER_RADIUS = PILLAR_RING_RADIUS + 2.0
const RING_FOCUS_INNER_RADIUS = PILLAR_RING_RADIUS - 0.5

// Seconds-scale smoothing on the focus distance itself. Slower than the
// camera's own position damping (2.6) so focus reads as following the move
// rather than being welded to it.
const FOCUS_DAMP_LAMBDA = 1.9

// The camera's real front face, not `lensFrontFieldPosition`: that anchor is a
// path input with no geometry at it, 0.35 in front of the face, so focusing on
// it held the Film subject out of focus at every close distance — worst exactly
// where the stop is.
const FILM_SUBJECT = new THREE.Vector3().fromArray(CAMERA_ANCHOR.frontFacePosition)
const DIGITAL_SUBJECT = new THREE.Vector3().fromArray(MONITOR_ANCHOR.screenWorldPosition)

/**
 * The MGRT wordmark — the focus subject for the hero.
 *
 * Without it this shot had no subject at all. The focus target is a blend of
 * the Film/Digital props and the colonnade's near arc, weighted by how far
 * outside the ring the camera is; at the hero the camera is 9.18 from the
 * ring's axis, so the blend resolves to `pillarDistance` — 3.68 — while the
 * wall it is looking at is 5.81 away. The hero was focused on a colonnade
 * that is not in the frame, and `pillarDistance` grows as the camera pulls
 * back, which is exactly the sharp-soft-sharp breathing.
 */
const HERO_SUBJECT = HERO_LOOKAT.clone()

/**
 * How the hero subject takes over. Fully in by the time the camera is square
 * on the wall, so the rack happens during the approach — where a focus pull
 * belongs — and not once the camera rests on the wordmark, which must be steady.
 */
const HERO_FOCUS_START = 0.82

function heroFocusWeightAt(progress) {
  return THREE.MathUtils.smoothstep(progress, HERO_FOCUS_START, HERO_T)
}

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

class DepthAwareBokehPass extends BokehPass {
  constructor(scene, camera, params) {
    super(scene, camera, params)
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

/**
 * Draws the airborne dust (`dustScene`) into the blurred frame.
 *
 * After the blur on purpose: the dust lays out its own defocus from the same
 * circle of confusion (see `volumetricLighting.js`'s `buildDust`), where a
 * gathering blur would average each speck away. Before the output pass, so it
 * is tone-mapped with everything else. One draw call, from a scene holding only
 * the dust.
 */
class DustPass extends Pass {
  constructor(scene, camera) {
    super()
    this.scene = scene
    this.camera = camera
    this.needsSwap = false
  }

  render(renderer, writeBuffer, readBuffer) {
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer)
    renderer.render(this.scene, this.camera)
    renderer.autoClear = autoClear
  }
}

/**
 * Keeps a still of the composed room, when one has been asked for.
 *
 * Sits here — after the lens, before the dust — because this is the last point
 * at which the buffer is a plain linear image of the room with nothing
 * overlaid. `heroPlate.js` explains in full why that exact point is the one
 * that makes the Impact print indistinguishable from the frame before it.
 *
 * Reads the buffer and writes nothing into the chain (`needsSwap = false`), so
 * on every frame that has not asked for a plate this costs one boolean.
 */
class HeroPlatePass extends Pass {
  constructor() {
    super()
    this.needsSwap = false
  }

  render(renderer, writeBuffer, readBuffer) {
    captureHeroPlate(renderer, readBuffer)
  }
}

const drawingBufferScratch = new THREE.Vector2()

export default function DepthOfField() {
  const { gl, scene, camera, size, viewport } = useThree()
  const focusDistance = useRef(null)
  const focusWasOnImpact = useRef(false)

  const { composer, bokeh, gtao } = useMemo(() => {
    // A multisampled target, explicitly. The canvas is created with
    // `antialias: true`, but that only ever applied to the default
    // framebuffer — once the scene renders into a composer target instead,
    // that MSAA is silently doing nothing and every edge in the room
    // aliases. Asking for samples here restores it.
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4,
    })
    const composerInstance = new EffectComposer(gl, target)
    composerInstance.addPass(new RenderPass(scene, camera))

    // Contact occlusion, between the render and the lens.
    //
    // Nothing in this room darkened where two surfaces met: the floor ran
    // uniformly bright right up to a column's base, so the columns read as
    // pasted onto it rather than standing on it. Analytic lights cannot
    // supply that — the shadowing at a contact point comes from geometry
    // occluding the *ambient* field, and an AmbientLight by definition
    // reaches every surface equally. The scanned `aoMap`s solve the same
    // problem within a single texture, but they know nothing about the room
    // around them; only a screen-space pass sees one object against another.
    //
    // GTAO rather than SSAO: it integrates visibility over the hemisphere
    // properly instead of counting occluded samples, so it does not produce
    // the dark halo around every silhouette edge that gives SSAO away.
    const gtaoPass = new GTAOPass(scene, camera, 1, 1)
    // A small radius keeps this reading as contact shading — the darkening in
    // the last few centimetres where surfaces meet — rather than as a general
    // dirt wash over the whole frame, which is the usual way AO announces
    // itself. `screenSpaceRadius: false` keeps that radius in world units, so
    // the effect does not change scale as the camera moves.
    // Radius is in world units and this room is ~20 across: at the 0.28 first
    // tried, the AO buffer came back essentially blank — the occlusion was
    // real but confined to a few centimetres, far too tight to survive being
    // blended into a dark frame. Verified by rendering the raw AO buffer
    // rather than assuming, which is the only way to tell a subtle effect
    // from one that is silently doing nothing.
    gtaoPass.updateGtaoMaterial({
      radius: 1.0,
      distanceExponent: 1,
      thickness: 1,
      scale: 1,
      samples: 16,
      distanceFallOff: 1,
      screenSpaceRadius: false,
    })
    // Held below 1: the room is already dark, and occlusion strong enough to
    // notice on its own would close up the shadow end entirely.
    gtaoPass.blendIntensity = 0.75
    composerInstance.addPass(gtaoPass)

    const bokehPass = new DepthAwareBokehPass(scene, camera, {
      focus: 5,
      aperture: APERTURE,
      maxblur: MAX_BLUR,
    })
    composerInstance.addPass(bokehPass)
    composerInstance.addPass(new HeroPlatePass())
    composerInstance.addPass(new DustPass(dustScene, camera))

    // Tone mapping and the output colour-space conversion move here.
    // Three applies neither when rendering into a render target, so
    // without this pass the whole scene would arrive raw and linear. With it, every material is tone-mapped exactly once, at the end,
    // which is what it was getting before this pipeline existed.
    composerInstance.addPass(new OutputPass())

    return { composer: composerInstance, bokeh: bokehPass, gtao: gtaoPass }
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setPixelRatio(viewport.dpr)
    composer.setSize(size.width, size.height)
    // GTAO keeps its own depth/normal targets and does not learn the new size
    // from the composer, so it has to be told directly.
    gtao.setSize(size.width, size.height)
    bokeh.uniforms.aspect.value = camera.aspect
  }, [composer, bokeh, gtao, camera, size, viewport.dpr])

  useEffect(() => () => composer.dispose(), [composer])

  // Priority > 0 hands the render loop over from R3F to this callback.
  useFrame(({ camera: activeCamera }, delta) => {
    /*
     * Nothing is drawn while the tab is in the background.
     *
     * This callback owns the render loop (priority 1), so returning here is
     * the whole saving: no composer pass, no GTAO, no scene render — a frame
     * that costs tens of milliseconds of GPU time to produce an image nobody
     * can see. Browsers already throttle `requestAnimationFrame` in a hidden
     * tab rather than stopping it, so without this a backgrounded tab keeps
     * paying for a full frame every second.
     *
     * Only this callback stops. Scroll position, the GSAP timeline, Lenis, the
     * journey's progress and video playback all keep their own state and are
     * untouched, so returning to the tab resumes the same shot. The focus
     * distance below stops damping too and picks up from the value it held,
     * which is what it would do after any frame it had not moved through.
     */
    if (document.visibilityState !== 'visible') return

    const subjectDistance = Math.min(
      activeCamera.position.distanceTo(FILM_SUBJECT),
      activeCamera.position.distanceTo(DIGITAL_SUBJECT),
    )

    // See RING_FOCUS_OUTER_RADIUS. `ringRadius` is the camera's own distance
    // from the colonnade's axis; subtracting the ring radius gives the depth
    // of its near arc, which is what the approach is focused on.
    const ringRadius = Math.hypot(
      activeCamera.position.x - PILLAR_RING_CENTER[0],
      activeCamera.position.z - PILLAR_RING_CENTER[1],
    )
    const pillarDistance = Math.max(ringRadius - PILLAR_RING_RADIUS, 0.1)
    const outsideRing = THREE.MathUtils.smoothstep(
      ringRadius,
      RING_FOCUS_INNER_RADIUS,
      RING_FOCUS_OUTER_RADIUS,
    )
    const approachDistance = THREE.MathUtils.lerp(subjectDistance, pillarDistance, outsideRing)

    // Hand the subject over to MGRT as the hero composition arrives, and keep
    // it there while the camera rests on the wordmark.
    // Content progress (see `contentProgress.js`), so a section flight past the
    // hero does not rack focus onto a wall it is not stopping at.
    const heroWeight = contentValue(heroFocusWeightAt, 'rendered')
    let targetDistance = THREE.MathUtils.lerp(
      approachDistance,
      activeCamera.position.distanceTo(HERO_SUBJECT),
      heroWeight,
    )

    // On the Impact set the subject is the print, then the table — both of
    // which the pose sampler already measures for us. The room's own subjects
    // are metres away through geometry that is no longer being drawn, so
    // without this the sheet arrives out of focus, which is the one thing the
    // handoff cannot survive: measured at 19/255 mean difference across the
    // cut before this, and it was nearly all blur.
    if (stageSwap.onImpact) targetDistance = impactStage.aimDistance

    focusDistance.current =
      focusDistance.current === null || stageSwap.onImpact !== focusWasOnImpact.current
        ? // Taken whole on the frame the sets swap. The focus DISTANCE changes
          // enormously (the wall was metres off, the sheet is centimetres), but
          // the subject is sharp on both sides of the cut and nothing else is
          // in frame, so there is nothing to see — whereas damping across it
          // would rack focus onto the print over a third of a second.
          targetDistance
        : THREE.MathUtils.damp(focusDistance.current, targetDistance, FOCUS_DAMP_LAMBDA, delta)
    focusWasOnImpact.current = stageSwap.onImpact

    // See SHALLOW_FOCUS_DISTANCE: stop down as the subject gets further away,
    // so wide shots hold the architecture and close-ups stay shallow.
    const apertureScale = THREE.MathUtils.clamp(
      SHALLOW_FOCUS_DISTANCE / Math.max(focusDistance.current, 0.0001),
      MIN_APERTURE_SCALE,
      1,
    )

    bokeh.uniforms.focus.value = focusDistance.current
    bokeh.uniforms.aperture.value = APERTURE * apertureScale
    bokeh.uniforms.maxblur.value = MAX_BLUR
    bokeh.uniforms.focusRange.value = THREE.MathUtils.clamp(
      focusDistance.current * FOCUS_RANGE_FRACTION,
      FOCUS_RANGE_MIN,
      FOCUS_RANGE_MAX,
    )
    // The bokeh shader linearises depth against the camera's own clip planes,
    // read live so they can never go stale against the camera.
    bokeh.uniforms.nearClip.value = activeCamera.near
    bokeh.uniforms.farClip.value = activeCamera.far

    // The same numbers for effects composited after the blur — see
    // `depthOfFieldShared.js`.
    depthOfFieldUniforms.uFocus.value = bokeh.uniforms.focus.value
    depthOfFieldUniforms.uAperture.value = bokeh.uniforms.aperture.value
    depthOfFieldUniforms.uMaxBlur.value = bokeh.uniforms.maxblur.value
    depthOfFieldUniforms.uFocusRange.value = bokeh.uniforms.focusRange.value
    depthOfFieldUniforms.uSceneDepth.value = bokeh.renderTargetDepth.texture
    depthOfFieldUniforms.uNearClip.value = activeCamera.near
    depthOfFieldUniforms.uFarClip.value = activeCamera.far
    depthOfFieldUniforms.uResolution.value.copy(gl.getDrawingBufferSize(drawingBufferScratch))

    composer.render(delta)
  }, 1)

  return null
}
