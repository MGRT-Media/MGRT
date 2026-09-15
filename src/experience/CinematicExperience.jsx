import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import Environment from './Environment.jsx'
import Monitor from './digital/Monitor.jsx'
import CinemaCamera from './film/CinemaCamera.jsx'
import { lightingParams } from './lighting/volumetricLighting.js'
import LoadErrorBoundary from './loading/LoadErrorBoundary.jsx'
import SceneReady from './loading/SceneReady.jsx'
import DepthOfField from './postprocessing/DepthOfField.jsx'
import ScrollCameraRig from './timeline/ScrollCameraRig.jsx'
import { sampleCameraPath } from './timeline/cameraPath.js'

// Derived directly from the path's own progress-0 sample, rather than a
// hand-copied literal — §4AY changed cameraPath.js's opening position (the
// exterior-orbit entrance) without this seed being updated to match, which
// is exactly the "visible jump once ScrollCameraRig takes over" the
// original comment below warns against. Importing the real function
// instead of a copied number makes that class of drift impossible.
const SEED_POSITION = sampleCameraPath(0).position

/**
 * Persistent Three.js scene: the architectural shell (Phase 1A, approved),
 * the primary volumetric lighting system (Phase 1B, approved), the
 * scroll-driven camera (Phase 1C, approved), the Digital monitor (Phase
 * 1D, approved), and the Phase 2 cinema-camera object. No portfolio
 * media beyond the Digital screen, audio, or post-processing belong here
 * yet.
 *
 * The `camera` prop below only seeds the initial mount state — it matches
 * `cameraPath.js`'s progress-0 keyframe exactly so there is no visible
 * jump once `ScrollCameraRig` takes over on the first frame.
 */
export default function CinematicExperience({ onReady }) {
  return (
    <Canvas
      className="experience-canvas"
      // "soft" selects PCFSoftShadowMap. The default PCF map gives a shadow a
      // fixed, slightly crunchy edge; the soft variant spreads the filter taps
      // so `shadow.radius` actually produces penumbra instead of just blur.
      shadows="soft"
      // Capped at 1.75 rather than 2. The post chain (GTAO + bokeh + output)
      // is fill-rate bound, so cost scales with the square of this number:
      // 2.0 is 30% more pixels than 1.75 for a difference no one can see on a
      // 3x phone display, where the panel is already far past the eye's
      // resolving power at arm's length.
      dpr={[1, 1.75]}
      // Exposure below 1 is what keeps the room dark now that the lighting
      // itself is physical. The previous approach reached the same darkness by
      // holding the LIGHTS down, which meant the only way to see anything was a
      // large flat ambient term — bright enough to wash out the shading that
      // makes stone read as stone. Lighting the room properly and then pulling
      // the exposure back is how a camera does it, and it keeps the falloff and
      // the shadow detail that the other order destroys.
      // `antialias` deliberately OFF. It only ever applied to the DEFAULT
      // framebuffer, and `DepthOfField` renders the scene into its own
      // composer target instead — that target's `samples: 4` is what actually
      // anti-aliases the room's edges (its own comment says as much). All the
      // context-level flag did was allocate a multisampled backbuffer whose
      // MSAA is wasted, since the only thing ever drawn to it is one
      // full-screen quad from `OutputPass`, and then pay to resolve that
      // buffer on every present.
      //
      // On Safari that resolve is not free: WebKit's WebGL-to-Metal path
      // handles multisampled backbuffer resolves markedly worse than Chrome's
      // ANGLE path, and this one buys nothing. Removing it changes no pixels —
      // edge quality still comes from the composer target.
      gl={{
        antialias: false,
        // 0.78 -> 1.0. That 0.78 was set against a room whose only real light
        // was a lamp in a wall, and it is a large part of why the site reads
        // as underexposed on a bright screen: it was pulling an already dark
        // frame down another two thirds of a stop. With daylight coming
        // through the roof the frame no longer needs protecting from
        // blowing out, and neutral is the honest place to grade from.
        toneMappingExposure: 1.0,
      }}
      camera={{
        position: SEED_POSITION,
        fov: 45,
        // Lowered from 0.1: the entrance pillars now bring foreground
        // geometry closer to the camera than before, so a tighter near
        // plane gives more clearance margin against near-frustum popping.
        near: 0.05,
        far: 100,
      }}
    >
      <color attach="background" args={['#0d0d0d']} />
      <fogExp2 attach="fog" args={[lightingParams.fog.color, lightingParams.fog.density]} />
      <ScrollCameraRig />
      <Environment />
      {/* Model-backed objects load their GLBs through `useLoader`, which
          suspends. The boundary is deliberately around these alone:
          `ScrollCameraRig` and `DepthOfField` must keep running while the
          assets arrive, and `DepthOfField` in particular owns the render
          loop — suspending it would stop the frame entirely. */}
      <Suspense fallback={null}>
        {/* A model that fails to load costs that object, not the page: without
            these boundaries the error unmounts the whole root, and
            `SceneReady` (outside them) would never get to open the gate. */}
        <LoadErrorBoundary name="CinemaCamera">
          <CinemaCamera />
        </LoadErrorBoundary>
        <LoadErrorBoundary name="Monitor">
          <Monitor />
        </LoadErrorBoundary>
        {/* Inside the boundary deliberately — see `SceneReady`. While the
            models are still loading this does not exist, so it cannot report
            a room that is missing two of its objects. */}
        <SceneReady onReady={onReady} />
      </Suspense>
      {/* Last child deliberately: this takes over the render loop (its
          useFrame runs at priority 1), so everything that needs to draw or
          render-to-texture for a frame must already have run. */}
      <DepthOfField />
    </Canvas>
  )
}
