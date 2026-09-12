import { useViewportHeight } from '../hooks/useViewportHeight'
import CinematicExperience from '../experience/CinematicExperience.jsx'
import { ScrollSpacer } from '../experience/timeline/ScrollTimelineProvider.jsx'
import ScrollLockIndicator from '../experience/ui/ScrollLockIndicator.jsx'
import SectionIndicator from '../experience/ui/SectionIndicator.jsx'
import FullscreenButton from '../experience/ui/FullscreenButton.jsx'
import SiteMark from '../experience/ui/SiteMark.jsx'
import GrainOverlay from '../experience/ui/GrainOverlay.jsx'

/**
 * The cinematic homepage, unchanged — this file is the previous contents of
 * `App.jsx`, moved wholesale so that `App.jsx` could become the router.
 *
 * It matters that every homepage-only import lives here and nowhere else:
 * `App.jsx` reaches this module through `React.lazy`, which makes the whole
 * graph below it — Three.js, the scene, the GLB/HDRI/texture loaders, the
 * post-processing stack, Lenis and GSAP ScrollTrigger — a separate chunk
 * that is only requested on '/'. A visitor landing directly on /work,
 * /about or /contact never downloads or initializes any of it.
 *
 * The overlay UI is part of that isolation rather than an exception to it:
 * SectionIndicator, ScrollLockIndicator and FullscreenButton all read
 * `scrollProgress` and the act beats, so hoisting any of them into the
 * router shell would pull the timeline — and through it Three.js — straight
 * back into the initial bundle.
 */
export default function Home() {
  useViewportHeight()

  return (
    <>
      <div className="app-shell">
        <CinematicExperience />
      </div>
      <SiteMark />
      <SectionIndicator />
      <ScrollLockIndicator />
      <FullscreenButton />
      <GrainOverlay />
      <ScrollSpacer />
    </>
  )
}
