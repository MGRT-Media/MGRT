import { useCallback, useEffect, useState } from 'react'
import { useViewportHeight } from '../hooks/useViewportHeight'
import CinematicExperience from '../experience/CinematicExperience.jsx'
import { ScrollSpacer } from '../experience/timeline/ScrollTimelineProvider.jsx'
import ScrollLockIndicator from '../experience/ui/ScrollLockIndicator.jsx'
import SectionIndicator from '../experience/ui/SectionIndicator.jsx'
import FullscreenButton from '../experience/ui/FullscreenButton.jsx'
import SectionCaption from '../experience/ui/SectionCaption.jsx'
import { DIGITAL_CAPTION, FILM_CAPTION } from '../experience/ui/sectionCaptions.js'
import SiteMark from '../experience/ui/SiteMark.jsx'
import GrainOverlay from '../experience/ui/GrainOverlay.jsx'
import LoadErrorBoundary from '../experience/loading/LoadErrorBoundary.jsx'
import { criticalAssetsSettled, preloadCriticalAssets } from '../experience/loading/criticalAssets.js'
import { loadDeferredAssets } from '../experience/loading/deferredAssets.js'
import {
  isStartupCoverShown,
  revealStartupCover,
  setExperienceRevealed,
  showStartupFailure,
} from '../experience/loading/startupCover.js'

/**
 * The cinematic homepage — this file is the previous contents of `App.jsx`,
 * moved wholesale so that `App.jsx` could become the router.
 *
 * It matters that every homepage-only import lives here and nowhere else:
 * `App.jsx` reaches this module through `React.lazy`, which makes the whole
 * graph below it — Three.js, the scene, the GLB/HDRI/texture loaders, the
 * post-processing stack, Lenis and GSAP ScrollTrigger — a separate chunk that
 * is only requested on '/'. A visitor landing directly on /work, /about or
 * /contact never downloads or initializes any of it.
 *
 * The overlay UI is part of that isolation rather than an exception to it:
 * SectionIndicator, ScrollLockIndicator and FullscreenButton all read
 * `scrollProgress` and the act beats, so hoisting any of them into the router
 * shell would pull the timeline — and through it Three.js — straight back into
 * the initial bundle.
 *
 * ---
 *
 * The three phases below are the loading gate. There is no loading screen: the
 * page is black from its first frame (`#startup-cover` in `index.html`, see
 * `loading/startupCover.js`), the scene builds and renders underneath that
 * black, and the reveal is the cover fading away. See
 * `loading/criticalAssets.js` for what is waited on — only what the opening
 * frame shows — and `loading/SceneReady.jsx` for what finally opens the gate.
 *
 * There is no timeout and no minimum duration. Readiness is the opening's
 * files having arrived (or failed — nothing in the preflight rejects) and the
 * scene having rendered.
 */
const PHASE = {
  /** Nothing mounted. The void. */
  PRELOAD: 'preload',
  /** Scene built and warming up, still hidden. */
  WARMUP: 'warmup',
  /** Revealed. */
  READY: 'ready',
}

export default function Home() {
  useViewportHeight()

  // A return from an internal page skips straight past the void: the preflight
  // is memoised, so there is nothing left to wait for and a second black frame
  // would read as a stall rather than as an opening.
  const [phase, setPhase] = useState(() => (criticalAssetsSettled() ? PHASE.WARMUP : PHASE.PRELOAD))

  useEffect(() => {
    if (phase !== PHASE.PRELOAD) return undefined
    let cancelled = false
    preloadCriticalAssets().then(() => {
      if (!cancelled) setPhase(PHASE.WARMUP)
    })
    return () => {
      cancelled = true
    }
  }, [phase])

  // Leaving for an internal page hides the experience again, so its input
  // gate closes until the next reveal.
  useEffect(() => () => setExperienceRevealed(false), [])

  // Stable identity: `SceneReady` holds this in an effect dependency, and a new
  // function each render would restart its warm-up every time.
  const handleReady = useCallback(() => {
    setPhase(PHASE.READY)
    setExperienceRevealed(true)
    revealStartupCover()
    // Everything the opening frame did not need (`deferredAssets.js`), once
    // the experience is on screen and the page is idle.
    loadDeferredAssets()
  }, [])

  if (phase === PHASE.PRELOAD) return null

  /*
   * Shown as soon as it mounts when the startup cover is over it, rather than
   * faded in at the reveal. The canvas then reaches the compositor while it is
   * still covered, so the reveal is only the cover fading away over a view
   * that is already rendering: the first composite of a full-screen WebGL
   * layer that had been at opacity 0 was measured as a ~110ms GPU stall on the
   * first visible frame. Returning from an internal page there is no cover,
   * and the shell's own fade does the reveal.
   */
  const shown = phase === PHASE.READY || isStartupCoverShown()

  return (
    <>
      <div className={`app-shell${shown ? ' app-shell--revealed' : ''}`}>
        {/* A scene that cannot start at all (no WebGL, a failed chunk inside
            it) says so on the startup cover instead of leaving the void. */}
        <LoadErrorBoundary name="CinematicExperience" onError={showStartupFailure}>
          <CinematicExperience onReady={handleReady} />
        </LoadErrorBoundary>
      </div>
      <SiteMark />
      <SectionIndicator />
      <ScrollLockIndicator />
      <SectionCaption caption={FILM_CAPTION} />
      <SectionCaption caption={DIGITAL_CAPTION} />
      <FullscreenButton />
      <GrainOverlay />
      {/* Mounted with the scene rather than before it, so the page has no
          scrollable height while the preflight runs. While the scene warms up
          behind the cover its input is ignored (`isExperienceRevealed`), so
          the experience still cannot be started before it is visible. */}
      <ScrollSpacer />
    </>
  )
}
