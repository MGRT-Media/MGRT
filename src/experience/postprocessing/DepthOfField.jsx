import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { CAMPAIGNS_SWAP_DISTANCE, campaignsRailDistance, HERO_LOOKAT } from '../timeline/cameraPath.js'
import { renderedProgress } from '../timeline/heroSequence.js'
import { HERO_T } from '../timeline/filmActBeats.js'
import { CAMERA_ANCHOR } from '../film/CinemaCamera.jsx'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'
import { PILLAR_RING_CENTER, PILLAR_RING_RADIUS } from '../Environment.jsx'

/**
 * Depth of field — the project's only post-processing pass.
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
 * at the Film beat and a fixed 0.67 ahead for the whole of Digital and
 * Campaigns. Focusing there would have put the focal plane inside the
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
// here. `maxblur` is in UV units, so 0.0055 is a little over half a percent
// of frame — a soft edge, not a smear.
const APERTURE = 0.0009
const MAX_BLUR = 0.0055

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
// `MIN_APERTURE_SCALE` floors it so the effect never switches off — at the
// orbit the near pillars come back to ~12% of the blur ceiling while the far
// wall still carries ~29%, which is the separation the pass exists for.
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
 * progress, so it stays correct no matter how the path is re-timed later —
 * the same reason the Campaigns fade below keys off rail distance.
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
 * The MGRT wordmark — the focus subject for the hero and the whole billboard
 * reveal.
 *
 * Without it this shot had no subject at all. The focus target is a blend of
 * the Film/Digital props and the colonnade's near arc, weighted by how far
 * outside the ring the camera is; at the hero the camera is 9.18 from the
 * ring's axis, so the blend resolves to `pillarDistance` — 3.68 — while the
 * wall it is looking at is 5.81 away. The hero was focused on a colonnade
 * that is not in the frame, and `pillarDistance` grows as the camera pulls
 * back, which is exactly the sharp-soft-sharp breathing.
 *
 * One subject serves both sides of the hand-over: the billboard stands on the
 * wall's own plane, so camera-to-wall and camera-to-billboard are the same
 * number. Focus therefore tracks the real subject distance continuously
 * through the swap, with nothing to jump.
 */
const HERO_SUBJECT = HERO_LOOKAT.clone()

/**
 * How the hero subject takes over. Fully in by the time the camera is square
 * on the wall, so the rack happens during the approach — where a focus pull
 * belongs — and not during the hold or the reveal, which must both be steady.
 */
const HERO_FOCUS_START = 0.82

/**
 * Depth of field must be OFF at the Campaigns hand-over, and this is not a
 * taste decision.
 *
 * The reveal works because the billboard's surface and the room it replaces
 * are the same image at the instant they trade places (`Billboard.jsx`).
 * They are not, however, at the same depth: the room recedes for tens of
 * units behind the camera's subject, while the billboard standing in for it
 * is a flat quad 5.9 away. A depth-driven blur therefore treats the two
 * completely differently — the real room would soften with distance and the
 * billboard would not — and the swap that the whole act is built around
 * would show as a visible snap into or out of focus.
 *
 * So the effect is ramped to nothing before the crossing and stays off for
 * the rest of the act. Keyed off the camera's own rail distance rather than
 * scroll progress, for the same reason the swap itself is: progress can fall
 * back below a gate while the camera is still past it. Costs nothing
 * visually — by then the shot is a wide exterior, which is exactly where a
 * shallow focus has least to offer.
 *
 * The window is set against the path's real rail distances rather than
 * chosen: Acts 0-2 reach 7.75 at most (the intro, at t = 0.067), and the
 * swap is at 10. Fading between those two means the effect is untouched
 * for the whole approach and provably zero before the hand-over. An
 * earlier window starting at 1 was measured to cut the intro's own focus
 * to near nothing, since the intro camera happens to sit far along this
 * same axis.
 */
const FADE_START_DISTANCE = 8.0
const FADE_END_DISTANCE = CAMPAIGNS_SWAP_DISTANCE - 0.4

export default function DepthOfField() {
  const { gl, scene, camera, size, viewport } = useThree()
  const focusDistance = useRef(null)

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

    const bokehPass = new BokehPass(scene, camera, {
      focus: 5,
      aperture: APERTURE,
      maxblur: MAX_BLUR,
    })
    composerInstance.addPass(bokehPass)

    // Tone mapping and the output colour-space conversion move here.
    // Three applies neither when rendering into a render target, so
    // without this pass the whole scene would arrive raw and linear — see
    // `campaigns/Billboard.jsx`, which hit exactly this and documents it.
    // With it, every material is tone-mapped exactly once, at the end,
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
  // `Billboard.jsx`'s render-to-texture pass runs at the default priority 0,
  // so it still completes before this composes the frame.
  useFrame(({ camera: activeCamera }, delta) => {
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
    // it there for the hold and the entire pull-back.
    const heroWeight = THREE.MathUtils.smoothstep(renderedProgress.value, HERO_FOCUS_START, HERO_T)
    const targetDistance = THREE.MathUtils.lerp(
      approachDistance,
      activeCamera.position.distanceTo(HERO_SUBJECT),
      heroWeight,
    )

    focusDistance.current =
      focusDistance.current === null
        ? targetDistance
        : THREE.MathUtils.damp(focusDistance.current, targetDistance, FOCUS_DAMP_LAMBDA, delta)

    const railDistance = campaignsRailDistance(activeCamera.position)
    const strength =
      1 - THREE.MathUtils.smoothstep(railDistance, FADE_START_DISTANCE, FADE_END_DISTANCE)

    // See SHALLOW_FOCUS_DISTANCE: stop down as the subject gets further away,
    // so wide shots hold the architecture and close-ups stay shallow.
    const apertureScale = THREE.MathUtils.clamp(
      SHALLOW_FOCUS_DISTANCE / Math.max(focusDistance.current, 0.0001),
      MIN_APERTURE_SCALE,
      1,
    )

    bokeh.uniforms.focus.value = focusDistance.current
    bokeh.uniforms.aperture.value = APERTURE * apertureScale * strength
    bokeh.uniforms.maxblur.value = MAX_BLUR * strength
    // The camera's far plane is not constant — `CampaignsLayerSwitch.jsx`
    // raises it at the swap so the exterior fits. The bokeh shader
    // linearises depth against these, so a stale pair would mis-read every
    // depth in the frame from that point on.
    bokeh.uniforms.nearClip.value = activeCamera.near
    bokeh.uniforms.farClip.value = activeCamera.far

    composer.render(delta)
  }, 1)

  return null
}
