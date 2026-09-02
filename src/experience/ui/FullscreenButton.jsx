import { useEffect, useState } from 'react'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { FILM_FOCUS_T } from '../timeline/filmActBeats.js'

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null
}

function requestFullscreen(el) {
  const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen
  return request?.call(el)
}

function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen
  return exit?.call(document)
}

/**
 * Full-screen toggle for Film and Digital, per explicit request — visible
 * from the moment the camera reaches Film (`FILM_FOCUS_T`) onward, which
 * covers both chapters, since there's no separate per-section DOM element
 * to attach a button to: this whole experience is one persistent WebGL
 * canvas (`.experience-canvas`, `CinematicExperience.jsx`), and "reaching
 * Film/Digital" is a `scrollProgress` value, not a viewport intersection.
 * Fullscreening that one canvas is therefore correct at both chapters —
 * whatever the camera is currently showing fills the screen.
 *
 * Matches `SectionIndicator.jsx`'s own established pattern: read
 * `scrollProgress.value` via a rAF loop (never React state for the
 * continuous value itself), only `useState` for the rare, discrete
 * visible/fullscreen boolean flips.
 */
export default function FullscreenButton() {
  const [visible, setVisible] = useState(() => scrollProgress.value >= FILM_FOCUS_T)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    let rafId
    let lastVisible = visible
    const tick = () => {
      const next = scrollProgress.value >= FILM_FOCUS_T
      if (next !== lastVisible) {
        lastVisible = next
        setVisible(next)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!getFullscreenElement())
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  // Scrolling back out of Film/Digital while fullscreen shouldn't leave a
  // dangling fullscreen session behind once the button that controls it
  // has disappeared.
  useEffect(() => {
    if (!visible && getFullscreenElement()) exitFullscreen()
  }, [visible])

  const handleClick = () => {
    if (getFullscreenElement()) {
      exitFullscreen()
      return
    }
    const canvas = document.querySelector('.experience-canvas')
    if (canvas) requestFullscreen(canvas)
  }

  return (
    <button
      type="button"
      className={`fullscreen-toggle${visible ? ' fullscreen-toggle--visible' : ''}`}
      onClick={handleClick}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        {isFullscreen ? (
          <path
            d="M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}
