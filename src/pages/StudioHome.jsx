import { useCallback, useEffect, useState } from 'react'
import { useViewportHeight } from '../hooks/useViewportHeight'
import LoadErrorBoundary from '../experience/loading/LoadErrorBoundary.jsx'
import {
  isStartupCoverShown,
  revealStartupCover,
  setExperienceRevealed,
  showStartupFailure,
} from '../experience/loading/startupCover.js'
import StageInput from '../experience/studio/StageInput.jsx'
import { resetStages } from '../experience/studio/stageNavigation.js'
import { preloadStudioAssets, studioAssetsSettled } from '../experience/studio/studioAssets.js'
import StudioExperience from '../experience/studio/StudioExperience.jsx'
import GrainOverlay from '../experience/ui/GrainOverlay.jsx'
import SiteMark from '../experience/ui/SiteMark.jsx'

/**
 * The Creative Table homepage, mounted in place of `Home.jsx` when the scene
 * selector asks for it (`sceneSelection.js`).
 *
 * The same loading gate as `Home.jsx`: nothing mounts until the files the
 * opening frame shows have arrived and been decoded (`studioAssets.js`), then
 * the scene builds behind the startup cover and the cover fades when it
 * reports it has rendered. Like `Home.jsx`, every import here stays out of the
 * initial bundle and out of the other scene's chunk.
 */
export default function StudioHome() {
  useViewportHeight()
  // A return from an internal page finds the files already decoded.
  const [loaded, setLoaded] = useState(studioAssetsSettled)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loaded) return undefined
    let cancelled = false
    preloadStudioAssets().then(() => {
      if (!cancelled) setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [loaded])

  useEffect(() => {
    resetStages()
    // Leaving for an internal page closes the input gate until the next reveal.
    return () => setExperienceRevealed(false)
  }, [])

  // Stable identity: `SceneReady` holds this in an effect dependency.
  const handleReady = useCallback(() => {
    setReady(true)
    // Input opens when the cover has finished fading, not as it starts.
    revealStartupCover({ onRevealed: () => setExperienceRevealed(true) })
  }, [])

  // Shown from the start when the cover is over it, so the canvas is already
  // compositing when the cover fades — see `Home.jsx`.
  const shown = ready || isStartupCoverShown()

  if (!loaded) return null

  return (
    <>
      <div className={`app-shell${shown ? ' app-shell--revealed' : ''}`}>
        <LoadErrorBoundary name="StudioExperience" onError={showStartupFailure}>
          <StudioExperience onReady={handleReady} />
        </LoadErrorBoundary>
      </div>
      <SiteMark />
      <GrainOverlay />
      <StageInput />
    </>
  )
}
