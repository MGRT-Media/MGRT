import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
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
import DepthAwareBokehPass from './DepthAwareBokehPass.js'
import { depthOfFieldUniforms } from './depthOfFieldShared.js'

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

    const bokehPass = new DepthAwareBokehPass(scene, camera)
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

    bokeh.setFocus(focusDistance.current, activeCamera)

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
