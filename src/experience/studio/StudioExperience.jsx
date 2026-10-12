import { Canvas } from '@react-three/fiber'
import SceneReady from '../loading/SceneReady.jsx'
import { STAGES } from './stageBeats.js'
import StudioCameraRig from './StudioCameraRig.jsx'
import StudioDepthOfField from './StudioDepthOfField.jsx'
import StudioLightingRig from './StudioLightingRig.jsx'
import StudioRoom from './StudioRoom.jsx'

const OPENING = STAGES[0].camera

/**
 * The Creative Table scene: one persistent canvas holding the room, its
 * lights, the stage-driven camera and the lens.
 *
 * The renderer settings are the original scene's, kept because each was
 * measured there (`docs/technical-architecture.md` §7): the pixel ratio is
 * capped at 1.75 because the post chain is fill-rate bound, and the context's
 * own antialiasing is off because the scene is drawn into the composer's
 * multisampled target instead.
 *
 * The `camera` prop only seeds the first frame, from the opening stage, so
 * there is no jump when `StudioCameraRig` takes over.
 */
export default function StudioExperience({ onReady }) {
  return (
    <Canvas
      className="experience-canvas"
      shadows="soft"
      dpr={[1, 1.75]}
      gl={{ antialias: false, toneMappingExposure: 1.0 }}
      camera={{ position: OPENING.position, fov: OPENING.fov, near: 0.05, far: 100 }}
    >
      <color attach="background" args={['#0d0d0d']} />
      <StudioCameraRig />
      <StudioLightingRig />
      <StudioRoom />
      <SceneReady onReady={onReady} />
      {/* Last child deliberately: it owns the render loop. */}
      <StudioDepthOfField />
    </Canvas>
  )
}
