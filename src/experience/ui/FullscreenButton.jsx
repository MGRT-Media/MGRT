import { useEffect, useState } from 'react'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { FILM_FOCUS_T, MONITOR_SNAP_T } from '../timeline/filmActBeats.js'
import { FILM_MEDIA_SRC } from '../film/CinemaCamera.jsx'
import { DIGITAL_MEDIA_SRC } from '../digital/Monitor.jsx'
import FullscreenVideoModal from './FullscreenVideoModal.jsx'

/**
 * Full-screen CTA for Film and Digital, visible from the moment the
 * camera reaches Film (`FILM_FOCUS_T`) onward — covers both chapters,
 * since there's no separate per-section DOM element to attach a button
 * to (this whole experience is one persistent WebGL canvas; "reaching
 * Film/Digital" is a `scrollProgress` value, not a viewport intersection).
 *
 * Clicking it opens `FullscreenVideoModal` — a custom full-viewport
 * pop-up playing whichever chapter's own file is currently active — per
 * explicit request to replace native `requestFullscreen()` on the canvas
 * with a dedicated video CTA overlay instead. `MONITOR_SNAP_T` is the
 * same Film/Digital split `SectionIndicator.jsx`'s own `getActiveIndex`
 * uses, reused rather than a second threshold.
 *
 * Matches `SectionIndicator.jsx`'s own established pattern: read
 * `scrollProgress.value` via a rAF loop (never React state for the
 * continuous value itself), only `useState` for the rare, discrete
 * visible/open boolean flips.
 */
export default function FullscreenButton() {
  const [visible, setVisible] = useState(() => scrollProgress.value >= FILM_FOCUS_T)
  const [isOpen, setIsOpen] = useState(false)

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

  // Scrolling back out of Film/Digital while the modal is open shouldn't
  // leave it dangling over content it no longer matches.
  useEffect(() => {
    if (!visible) setIsOpen(false)
  }, [visible])

  const activeSrc = scrollProgress.value >= MONITOR_SNAP_T ? DIGITAL_MEDIA_SRC : FILM_MEDIA_SRC

  return (
    <>
      <button
        type="button"
        className={`fullscreen-toggle${visible ? ' fullscreen-toggle--visible' : ''}`}
        onClick={() => setIsOpen(true)}
        aria-label="Open full screen video"
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && <FullscreenVideoModal src={activeSrc} onClose={() => setIsOpen(false)} />}
    </>
  )
}
