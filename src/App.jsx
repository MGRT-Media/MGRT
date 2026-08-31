import { useViewportHeight } from './hooks/useViewportHeight'
import CinematicExperience from './experience/CinematicExperience.jsx'
import { ScrollSpacer } from './experience/timeline/ScrollTimelineProvider.jsx'

export default function App() {
  useViewportHeight()

  return (
    <>
      <div className="app-shell">
        <CinematicExperience />
      </div>
      <ScrollSpacer />
    </>
  )
}
