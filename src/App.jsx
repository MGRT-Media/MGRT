import { useViewportHeight } from './hooks/useViewportHeight'
import CinematicExperience from './experience/CinematicExperience.jsx'

export default function App() {
  useViewportHeight()

  return (
    <div className="app-shell">
      <CinematicExperience />
    </div>
  )
}
