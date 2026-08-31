import { Canvas } from '@react-three/fiber'
import Environment from './Environment.jsx'

/**
 * Persistent Three.js scene and the architectural shell (Phase 1A,
 * approved) plus the primary volumetric lighting system (Phase 1B). No
 * scroll-driven camera (1C), portfolio content, audio, or post-processing
 * belong here yet.
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
      <Environment />
    </Canvas>
  )
}
