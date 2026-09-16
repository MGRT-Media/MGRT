import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { whenAssetUpgradesSettled } from './assetReadiness.js'
import { armShadowFreeze, resetShadowUpdates } from '../lighting/shadowUpdates.js'

/**
 * How many frames to render before the canvas is shown.
 *
 * One, measured rather than assumed. Three was the original guess, on the
 * theory that `gl.compile` links programs but the first frames still touch
 * things it cannot: the shadow map, the post chain's own render targets, and
 * `ScrollCameraRig` writing the camera's real transform on its first
 * `useFrame`.
 *
 * That theory missed something. The canvas is hidden with `opacity: 0`, not
 * unmounted — so R3F's loop has been rendering this scene on every frame since
 * it mounted, roughly a second before the gate ever gets here. Every one of
 * those allocations has therefore already happened. Instrumented over eight
 * consecutive warm-up frames, `gl.info` does not move at all: textures 47,
 * geometries 52, programs 40, draw calls and triangles identical, and the
 * camera already at its correct progress-0 transform on frame 1.
 *
 * What the one remaining frame is for: `whenAssetUpgradesSettled` resolves the
 * instant the scanned maps are ASSIGNED, and an assigned texture uploads on the
 * next render, not on assignment. One frame guarantees that upload has
 * happened. It also guarantees one full composer pass after `gl.compile` —
 * measured to link three further programs — so zero frames would not be safe.
 * Frames two and three were buying nothing.
 */
const WARMUP_FRAMES = 1

/**
 * How long to wait for the driver to finish linking before revealing anyway.
 *
 * `compileAsync` polls `KHR_parallel_shader_compile` for each program it
 * started, and a program that is replaced or disposed while it is waiting
 * never reports ready — a hang with nothing to show for it. The race below
 * bounds that: after this the opening is revealed regardless, which is no
 * worse than the synchronous compile it replaces.
 */
const COMPILE_TIMEOUT_MS = 2000

/**
 * Decides when the room is actually ready to be looked at.
 *
 * Mounted as a child of the same `Suspense` boundary as `CinemaCamera` and
 * `Monitor`, which is the whole trick: if those are still loading, this
 * component does not exist, so its effect cannot run and the scene cannot be
 * revealed. React's own boundary becomes the model-readiness signal instead of
 * a second mechanism that guesses at it.
 *
 * The remaining two conditions are the in-place material upgrades
 * (`assetReadiness`) and a handful of rendered frames. Together they cover
 * every asynchronous step that used to be visible: models appearing, scanned
 * stone and brass replacing their stand-ins, the HDRI replacing the generated
 * environment, and the first frame's shader compilation.
 *
 * Plain `requestAnimationFrame` rather than `useFrame`: `DepthOfField` takes
 * the loop over at priority 1, and a later subscription on a component that
 * renders nothing was observed never to be driven.
 */
export default function SceneReady({ onReady }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  /**
   * Links every program in the scene before anything is shown.
   *
   * Measured: all 48 of this experience's programs are linked here — Film,
   * Digital and the hero introduce none — so this is the only compilation the
   * visitor can ever pay for, and the only question is whether it blocks.
   * `compile` did: the first composer render sat in `getProgramParameter` for
   * 184ms waiting on the driver. `compileAsync` starts the same work and polls
   * for completion instead, so the wait happens off the main thread while the
   * page is still covered.
   */
  const compileScene = () => {
    if (typeof gl.compileAsync !== 'function') {
      gl.compile(scene, camera)
      return Promise.resolve()
    }
    return Promise.race([
      gl.compileAsync(scene, camera).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, COMPILE_TIMEOUT_MS)),
    ])
  }

  useEffect(() => {
    let cancelled = false
    let handle = 0

    whenAssetUpgradesSettled()
      .then(() => (cancelled ? null : compileScene()))
      .then(() => {
      if (cancelled) return

      // The room is complete and has been drawn: its shadow map can be held
      // from here rather than redrawn every frame (`shadowUpdates.js`).
      armShadowFreeze()

      let frames = 0
      const tick = () => {
        frames += 1
        if (frames >= WARMUP_FRAMES) {
          onReady()
          return
        }
        handle = requestAnimationFrame(tick)
      }
      handle = requestAnimationFrame(tick)
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(handle)
      // A remount builds a new renderer and scene; its shadow map starts
      // unfrozen again.
      resetShadowUpdates()
    }
  }, [gl, scene, camera, onReady])

  return null
}
