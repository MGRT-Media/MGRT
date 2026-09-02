import { useViewportHeight } from './hooks/useViewportHeight'
import CinematicExperience from './experience/CinematicExperience.jsx'
import { ScrollSpacer } from './experience/timeline/ScrollTimelineProvider.jsx'
import ScrollLockIndicator from './experience/ui/ScrollLockIndicator.jsx'
import SectionIndicator from './experience/ui/SectionIndicator.jsx'
import FullscreenButton from './experience/ui/FullscreenButton.jsx'

export default function App() {
  useViewportHeight()

  return (
    <>
      <div className="app-shell">
        <CinematicExperience />
      </div>
      <SectionIndicator />
      <ScrollLockIndicator />
      <FullscreenButton />
      <ScrollSpacer />
    </>
  )
}
