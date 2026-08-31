import { useEffect } from 'react'

/**
 * Pins --app-height to the viewport height at mount and only updates it when
 * the viewport *width* changes (real resize/orientation change) — not on
 * every height fluctuation, which on mobile Safari/Chrome also fires when
 * the address bar collapses/expands during scroll. See
 * technical-architecture.md §16.
 */
export function useViewportHeight() {
  useEffect(() => {
    let lastWidth = window.innerWidth

    const setHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
    }

    setHeight()

    const handleResize = () => {
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth
        setHeight()
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', setHeight)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', setHeight)
    }
  }, [])
}
