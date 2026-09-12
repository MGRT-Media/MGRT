import { useCallback, useEffect, useState } from 'react'
import { useViewportHeight } from '../hooks/useViewportHeight'
import CinematicExperience from '../experience/CinematicExperience.jsx'
import { ScrollSpacer } from '../experience/timeline/ScrollTimelineProvider.jsx'
import ScrollLockIndicator from '../experience/ui/ScrollLockIndicator.jsx'
import SectionIndicator from '../experience/ui/SectionIndicator.jsx'
import FullscreenButton from '../experience/ui/FullscreenButton.jsx'
import SiteMark from '../experience/ui/SiteMark.jsx'
import GrainOverlay from '../experience/ui/GrainOverlay.jsx'
import {
  CRITICAL_ASSET_TIMEOUT_MS,
  criticalAssetsSettled,
  preloadCriticalAssets,
} from '../experience/loading/criticalAssets.js'

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
 * The three phases below are the loading gate. The void is the loader, so
 * there is nothing to show during 'preload' — the page's own background IS the
 * opening state, and rendering nothing is how it stays that way. See
 * `loading/criticalAssets.js` for what is waited on and
 * `loading/SceneReady.jsx` for what finally opens the gate.
 */
const PHASE = {
  /** Nothing mounted. The void, with only the global navigation over it. */
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
    const advance = () => !cancelled && setPhase(PHASE.WARMUP)

    preloadCriticalAssets().then(advance)
    // The gate is an improvement, not a dependency. If the network stalls, the
    // visitor gets the room the way it behaved before this existed rather than
    // an indefinite black screen.
    const timeout = setTimeout(advance, CRITICAL_ASSET_TIMEOUT_MS)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [phase])

  // Stable identity: `SceneReady` holds this in an effect dependency, and a new
  // function each render would restart its warm-up every time.
  const handleReady = useCallback(() => setPhase(PHASE.READY), [])

  if (phase === PHASE.PRELOAD) return null

  return (
    <>
      <div className={`app-shell${phase === PHASE.READY ? ' app-shell--revealed' : ''}`}>
        <CinematicExperience onReady={handleReady} />
      </div>
      <SiteMark />
      <SectionIndicator />
      <ScrollLockIndicator />
      <FullscreenButton />
      <GrainOverlay />
      {/* Mounted with the scene rather than before it, so the page has no
          scrollable height while the void is up — the experience cannot be
          started before it is visible. */}
      <ScrollSpacer />
    </>
  )
}
