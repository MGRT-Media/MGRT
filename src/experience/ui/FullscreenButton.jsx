import { useCallback, useEffect, useRef, useState } from 'react'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { contentValue } from '../timeline/contentProgress.js'
import { DIGITAL_EXIT_T, FILM_FOCUS_T, MONITOR_SNAP_T } from '../timeline/filmActBeats.js'
import { FILM_MEDIA_SRC, lensIgniteAt } from '../film/CinemaCamera.jsx'
import { DIGITAL_MEDIA_SRC } from '../digital/Monitor.jsx'
import FullscreenVideoModal from './FullscreenVideoModal.jsx'

/**
 * Full-screen CTA for Film and Digital, visible from the moment the
 * camera reaches Film (`FILM_FOCUS_T`) until it leaves Digital for the MGRT
 * hero (`DIGITAL_EXIT_T`) — covers both chapters, since there's no separate
 * per-section DOM element to attach a button to (this whole experience is
 * one persistent WebGL canvas; "reaching Film/Digital" is a
 * `scrollProgress` value, not a viewport intersection).
 *
 * The hero has no clip of its own to open full screen, so the button ends
 * where the camera leaves the monitor. `DIGITAL_EXIT_T` is the same boundary
 * `SectionIndicator.jsx`'s `getActiveIndex` uses for the Digital -> hero
 * hand-over, reused rather than a third threshold.
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
function isInRange(progress) {
  return progress >= FILM_FOCUS_T && progress < DIGITAL_EXIT_T
}

/**
 * Follows the content, not raw scroll, so the button appears with the Film or
 * Digital picture it opens: as the camera arrives, and during a section flight
 * only once the destination has faded in more than the origin — never for a
 * section the flight is passing.
 */
function isButtonShown() {
  return contentValue((progress) => (isInRange(progress) ? 1 : 0)) >= 0.5 || isFilmPreviewShown()
}

/**
 * The Film preview is on screen: faded in more than halfway, by the same curve
 * that fades it in (`CinemaCamera.jsx`).
 *
 * `isInRange` alone waited for progress to reach `FILM_FOCUS_T`, and it only
 * gets there when the camera has finished settling. The camera eases onto the
 * lens asymptotically, so that was ~3s after arriving — after the lock's
 * countdown had already run out — while the preview itself had been playing
 * in plain view the whole time. The countdown never gated the button; the
 * camera's last few centimetres did. The preview's own visibility is the
 * moment the button is meant to follow, in both scroll directions.
 */
function isFilmPreviewShown() {
  return contentValue(lensIgniteAt) >= 0.5
}

export default function FullscreenButton() {
  const [visible, setVisible] = useState(isButtonShown)
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef(null)

  // Closing hands keyboard focus back to the control that opened the video,
  // rather than dropping it to the document, as long as that control is still
  // on screen. Stable identity: the modal binds its Escape listener to it.
  const closeModal = useCallback(() => {
    setIsOpen(false)
    if (buttonRef.current?.classList.contains('fullscreen-toggle--visible')) {
      buttonRef.current.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    let rafId
    let lastVisible = visible
    const tick = () => {
      const next = isButtonShown()
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

  // Scrolling out of Film/Digital while the modal is open — back toward
  // the Intro, or forward to the hero — shouldn't leave it dangling
  // over content it no longer matches.
  useEffect(() => {
    if (!visible) setIsOpen(false)
  }, [visible])

  const activeSrc = scrollProgress.value >= MONITOR_SNAP_T ? DIGITAL_MEDIA_SRC : FILM_MEDIA_SRC

  return (
    <>
      <button
        ref={buttonRef}
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
      {isOpen && <FullscreenVideoModal src={activeSrc} onClose={closeModal} />}
    </>
  )
}
