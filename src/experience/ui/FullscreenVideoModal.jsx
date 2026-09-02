import { useEffect, useRef } from 'react'

/**
 * Full-viewport video pop-up CTA (FullscreenButton.jsx's own modal) — per
 * explicit request to replace native `requestFullscreen()` with a custom
 * overlay: clicking the trigger button now opens this instead of putting
 * the WebGL canvas into browser fullscreen. Owns its own dedicated
 * `<video>` element, entirely separate from the off-DOM video elements
 * `CinemaCamera.jsx`/`Monitor.jsx` create for their own WebGL texture
 * playback — this is a real, visible DOM video, not a rerouted texture,
 * so it can't interfere with (or be interfered with by) the scene's own
 * ignite/play-pause logic.
 *
 * Dismissible three ways, per the brief: the close button, clicking the
 * backdrop outside the video, or Escape — all funnel through the same
 * `onClose` so `FullscreenButton.jsx` has one place to unmount this.
 */
export default function FullscreenVideoModal({ src, onClose }) {
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleBackdropClick = (event) => {
    if (event.target === dialogRef.current) onClose()
  }

  return (
    <div
      ref={dialogRef}
      className="fullscreen-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Full screen video"
      onClick={handleBackdropClick}
    >
      <button
        type="button"
        className="fullscreen-modal__close"
        onClick={onClose}
        aria-label="Close full screen video"
        ref={closeButtonRef}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M5 5l14 14M19 5L5 19"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <video className="fullscreen-modal__video" src={src} autoPlay loop controls playsInline />
    </div>
  )
}
