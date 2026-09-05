import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import Environment from './Environment.jsx'
import Billboard from './campaigns/Billboard.jsx'
import CampaignsLayerSwitch from './campaigns/CampaignsLayerSwitch.jsx'
import ExteriorEnvironment from './campaigns/ExteriorEnvironment.jsx'
import Monitor from './digital/Monitor.jsx'
import CinemaCamera from './film/CinemaCamera.jsx'
import { lightingParams } from './lighting/volumetricLighting.js'
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
export default function CinematicExperience() {
  return (
    <Canvas
      className="experience-canvas"
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
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
        <CinemaCamera />
        <Monitor />
      </Suspense>
      {/* Act 3 (Campaigns). The exterior world and the billboard sit on
          their own render layer and are invisible until the camera swaps
          onto it at CAMPAIGNS_SWAP_T — see campaigns/layers.js. */}
      <CampaignsLayerSwitch />
      <Billboard />
      <Suspense fallback={null}>
        <ExteriorEnvironment />
      </Suspense>
      {/* Last child deliberately: this takes over the render loop (its
          useFrame runs at priority 1), so everything that needs to draw or
          render-to-texture for a frame must already have run. */}
      <DepthOfField />
    </Canvas>
  )
}
