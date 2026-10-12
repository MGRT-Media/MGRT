import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import DepthAwareBokehPass from '../postprocessing/DepthAwareBokehPass.js'
import { cameraProgress } from '../timeline/journeyProgress.js'
import { sampleStageCameraInto } from './stageSampling.js'

// Smoothing on the focus distance, so focus follows a move the way a focus
// puller does rather than being welded to it.
const FOCUS_DAMP_LAMBDA = 1.9

const positionScratch = new THREE.Vector3()
const subjectScratch = new THREE.Vector3()

/**
 * The studio's post-processing chain, and the lens that owns it: scene,
 * contact occlusion, depth of field, output.
 *
 * The same chain as the original scene's `DepthOfField`, with the one thing
 * that tied that component to its room replaced: focus. Here the focal plane
 * sits on whatever the current stage looks at, read from the stage definitions
 * — so the lens knows nothing about the room's geometry and follows any change
 * to the stages on its own.
 *
 * Takes over the render loop (priority 1), so it must be the canvas's last
 * child.
 */
export default function StudioDepthOfField() {
  const { gl, scene, camera, size, viewport } = useThree()
  const focusDistance = useRef(null)

  const { composer, bokeh, gtao } = useMemo(() => {
    // Multisampled explicitly: the canvas's own antialiasing never applies to
    // a composer target, so this is what anti-aliases the room's edges.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    const composerInstance = new EffectComposer(gl, target)
    composerInstance.addPass(new RenderPass(scene, camera))

    // Contact shading where surfaces meet. The radius is in world units and is
    // provisional: it is tuned with the real room's materials in Phase 3.
    const gtaoPass = new GTAOPass(scene, camera, 1, 1)
    gtaoPass.updateGtaoMaterial({
      radius: 0.5,
      distanceExponent: 1,
      thickness: 1,
      scale: 1,
      samples: 16,
      distanceFallOff: 1,
      screenSpaceRadius: false,
    })
    gtaoPass.blendIntensity = 0.75
    composerInstance.addPass(gtaoPass)

    const bokehPass = new DepthAwareBokehPass(scene, camera)
    composerInstance.addPass(bokehPass)

    // Tone mapping and the output colour space, applied once, at the end.
    composerInstance.addPass(new OutputPass())

    return { composer: composerInstance, bokeh: bokehPass, gtao: gtaoPass }
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setPixelRatio(viewport.dpr)
    composer.setSize(size.width, size.height)
    // GTAO keeps its own targets and is not told the new size by the composer.
    gtao.setSize(size.width, size.height)
    bokeh.uniforms.aspect.value = camera.aspect
  }, [composer, bokeh, gtao, camera, size, viewport.dpr])

  useEffect(() => () => composer.dispose(), [composer])

  useFrame(({ camera: activeCamera }, delta) => {
    // Nothing is drawn while the tab is in the background.
    if (document.visibilityState !== 'visible') return

    sampleStageCameraInto(cameraProgress.value, positionScratch, subjectScratch)
    const targetDistance = activeCamera.position.distanceTo(subjectScratch)
    focusDistance.current =
      focusDistance.current === null
        ? targetDistance
        : THREE.MathUtils.damp(focusDistance.current, targetDistance, FOCUS_DAMP_LAMBDA, delta)
    bokeh.setFocus(focusDistance.current, activeCamera)

    composer.render(delta)
  }, 1)

  return null
}
