import { Canvas } from '@react-three/fiber'
import Environment from './Environment.jsx'

/**
 * Phase 1A — Environment Shell.
 *
 * Mounts the persistent Three.js scene and the static architectural shell.
 * No lighting design (1B), no scroll-driven camera (1C), no portfolio
 * content, audio, or post-processing belong here yet.
 */
export default function CinematicExperience() {
  return (
    <Canvas
      className="experience-canvas"
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
