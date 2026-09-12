import { createContext, useContext, useEffect, useState } from 'react'

/**
 * A ~40-line path router, deliberately not `react-router-dom`.
 *
 * This site has four static routes, no params, no nesting and no loaders —
 * everything a routing library exists to solve. Adding one would be a new
 * runtime dependency larger than the feature it serves, so the smallest
 * maintainable implementation is the platform's own History API.
 *
 * Navigation goes through real `<a href>` elements (`RouteLink` below), so
 * middle-click, cmd-click, right-click -> open in new tab and crawlers all
 * behave normally; only a plain left-click is intercepted and turned into a
 * `pushState`.
 */

const RouteContext = createContext('/')

function currentPath() {
  // Trailing slashes normalized so '/work/' and '/work' are one route.
  const path = window.location.pathname.replace(/\/+$/, '')
  return path === '' ? '/' : path
}

/**
 * `main.jsx` sets `history.scrollRestoration = 'manual'` because the
 * cinematic timeline treats scroll position 0 as "the dark intro start."
 * That covers reloads; this covers in-app navigation, which must land at the
 * top for the same reason — returning to `/` remounts the experience with
 * all of its state defaulted to t: 0.
 */
function resetScroll() {
  window.scrollTo(0, 0)
}

export function navigate(to) {
  if (to === currentPath()) return
  window.history.pushState({}, '', to)
  // pushState fires no event of its own; re-using popstate keeps a single
  // listener as the one place route changes are observed.
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function RouteProvider({ children }) {
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const onPopState = () => {
      resetScroll()
      setPath(currentPath())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return <RouteContext.Provider value={path}>{children}</RouteContext.Provider>
}

export function useRoute() {
  return useContext(RouteContext)
}

/**
 * An ordinary anchor that stays an ordinary anchor for every gesture except
 * the plain left-click it upgrades to a client-side transition.
 */
export function RouteLink({ href, onNavigate, children, ...rest }) {
  const handleClick = (event) => {
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(href)
    onNavigate?.()
  }

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
