import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { whenAssetUpgradesSettled } from './assetReadiness.js'

/**
 * How many frames to render before the canvas is shown.
 *
 * Not a guess at how long something takes — the real work is already done by
 * the time this counts. It exists because `gl.compile` links programs but the
 * first frames still touch things it cannot: the shadow map is rendered on
 * demand, the post chain (GTAO, bokeh, output) allocates and fills its own
 * targets, and `ScrollCameraRig` writes the camera's real transform on its
 * first `useFrame`. Three frames is enough for all of it and is a few tens of
 * milliseconds at the end of a load measured in seconds.
 */
const WARMUP_FRAMES = 3

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
 * Plain `requestAnimationFrame` rather than `useFrame`, for the reason
 * `CampaignsGate` documents: `DepthOfField` takes the loop over at priority 1,
 * and a later subscription on a component that renders nothing was observed
 * never to be driven.
 */
export default function SceneReady({ onReady }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    let cancelled = false
    let handle = 0

    whenAssetUpgradesSettled().then(() => {
      if (cancelled) return
      // Link every program in the scene now, while nothing is visible. Without
      // this the first visible frame is the one that pays for compilation,
      // which on a scene this size is a stall precisely where it is least
      // wanted.
      gl.compile(scene, camera)

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
    }
  }, [gl, scene, camera, onReady])

  return null
}
