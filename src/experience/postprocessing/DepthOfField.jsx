import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { CAMPAIGNS_SWAP_DISTANCE, campaignsRailDistance } from '../timeline/cameraPath.js'
import { CAMERA_ANCHOR } from '../film/CinemaCamera.jsx'
import { MONITOR_ANCHOR } from '../digital/Monitor.jsx'

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

// Seconds-scale smoothing on the focus distance itself. Slower than the
// camera's own position damping (2.6) so focus reads as following the move
// rather than being welded to it.
const FOCUS_DAMP_LAMBDA = 1.9

const FILM_SUBJECT = new THREE.Vector3().fromArray(CAMERA_ANCHOR.lensFrontFieldPosition)
const DIGITAL_SUBJECT = new THREE.Vector3().fromArray(MONITOR_ANCHOR.screenWorldPosition)

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

  const { composer, bokeh } = useMemo(() => {
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

    return { composer: composerInstance, bokeh: bokehPass }
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setPixelRatio(viewport.dpr)
    composer.setSize(size.width, size.height)
    bokeh.uniforms.aspect.value = camera.aspect
  }, [composer, bokeh, camera, size, viewport.dpr])

  useEffect(() => () => composer.dispose(), [composer])

  // Priority > 0 hands the render loop over from R3F to this callback.
  // `Billboard.jsx`'s render-to-texture pass runs at the default priority 0,
  // so it still completes before this composes the frame.
  useFrame(({ camera: activeCamera }, delta) => {
    const targetDistance = Math.min(
      activeCamera.position.distanceTo(FILM_SUBJECT),
      activeCamera.position.distanceTo(DIGITAL_SUBJECT),
    )

    focusDistance.current =
      focusDistance.current === null
        ? targetDistance
        : THREE.MathUtils.damp(focusDistance.current, targetDistance, FOCUS_DAMP_LAMBDA, delta)

    const railDistance = campaignsRailDistance(activeCamera.position)
    const strength =
      1 - THREE.MathUtils.smoothstep(railDistance, FADE_START_DISTANCE, FADE_END_DISTANCE)

    bokeh.uniforms.focus.value = focusDistance.current
    bokeh.uniforms.aperture.value = APERTURE * strength
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
