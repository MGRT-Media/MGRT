import { useEffect } from 'react'

/**
 * Keeps `--app-height` on the height the visitor can actually see.
 *
 * The canvas, the scroll spacer and the opening image are all sized from this,
 * so it has to be the VISIBLE height or the composition runs past the fold:
 * pinned to the height at load — which is what this did until 2026-09-20, to
 * keep a mobile address bar from resizing the scene mid-scroll — a phone whose
 * bar came back left the canvas 44px taller than the window and the bottom of
 * every shot below the edge of the screen.
 *
 * It is safe to follow now. A viewport change no longer disturbs the journey:
 * `ScrollTimelineProvider` holds the camera's progress across the relayout and
 * puts the scroll position back afterwards, and the framing re-fits itself
 * (`viewportFit.js`) rather than cropping.
 *
 * `visualViewport` is the honest measure of what is on screen, but it also
 * shrinks when the visitor pinch-zooms, and a pinch is not a layout change —
 * so its height is used at scale 1 and `innerHeight` stands in otherwise.
 */
function visibleHeight() {
  const viewport = window.visualViewport
  if (viewport && viewport.scale <= 1.01) return Math.round(viewport.height)
  return window.innerHeight
}

export function useViewportHeight() {
  useEffect(() => {
    let applied = 0

    const setHeight = () => {
      const height = visibleHeight()
      // A pixel of jitter is not a layout change: iOS reports fractional
      // heights that round differently frame to frame while a bar animates.
      if (Math.abs(height - applied) < 2) return
      applied = height
      document.documentElement.style.setProperty('--app-height', `${height}px`)
    }

    setHeight()

    window.addEventListener('resize', setHeight)
    window.addEventListener('orientationchange', setHeight)
    window.visualViewport?.addEventListener('resize', setHeight)

    return () => {
      window.removeEventListener('resize', setHeight)
      window.removeEventListener('orientationchange', setHeight)
      window.visualViewport?.removeEventListener('resize', setHeight)
    }
  }, [])
}
