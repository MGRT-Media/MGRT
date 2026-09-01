import { Canvas } from '@react-three/fiber'
import Environment from './Environment.jsx'
import Monitor from './digital/Monitor.jsx'
import CinemaCamera from './film/CinemaCamera.jsx'
import { lightingParams } from './lighting/volumetricLighting.js'
import ScrollCameraRig from './timeline/ScrollCameraRig.jsx'

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
        position: [-1.0, 1.6, 8],
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
      <CinemaCamera />
      <Monitor />
    </Canvas>
  )
}
