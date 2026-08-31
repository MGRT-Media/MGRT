import { Canvas } from '@react-three/fiber'
import Environment from './Environment.jsx'
import Monitor from './digital/Monitor.jsx'
import { lightingParams } from './lighting/volumetricLighting.js'
import ScrollCameraRig from './timeline/ScrollCameraRig.jsx'

/**
 * Persistent Three.js scene: the architectural shell (Phase 1A, approved),
 * the primary volumetric lighting system (Phase 1B, approved), the
 * scroll-driven camera (Phase 1C, approved), and the provisional Digital
 * monitor anchor (Phase 1D). No Phase 2 content, cinema-camera object,
 * portfolio media, audio, or post-processing belong here yet.
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
        position: [0, 1.6, 9],
        fov: 45,
        near: 0.1,
        far: 100,
      }}
    >
      <color attach="background" args={['#0d0d0d']} />
      <fogExp2 attach="fog" args={[lightingParams.fog.color, lightingParams.fog.density]} />
      <ScrollCameraRig />
      <Environment />
      <Monitor />
    </Canvas>
  )
}
