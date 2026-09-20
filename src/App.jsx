import { Suspense, lazy, useEffect } from 'react'
import { RouteProvider, useRoute } from './router/Router.jsx'
import GlobalNav from './navigation/GlobalNav.jsx'
import { PAGE_TITLES } from './navigation/navLinks.js'
import BlankPage from './pages/BlankPage.jsx'
import LoadErrorBoundary from './experience/loading/LoadErrorBoundary.jsx'
import { revealStartupCover, showStartupFailure } from './experience/loading/startupCover.js'

/**
 * Lazy on purpose, and the single most important line in this file: it is
 * what keeps Three.js, the scene assets and the scroll timeline out of the
 * initial bundle for /work, /about and /contact. See `pages/Home.jsx`.
 */
const Home = lazy(() => import('./pages/Home.jsx'))

function Routes() {
  const path = useRoute()
  const isHome = path === '/'
  const pageTitle = PAGE_TITLES[path]

  useEffect(() => {
    document.title = isHome || !pageTitle ? 'MGRT Media' : `${pageTitle} — MGRT Media`
  }, [isHome, pageTitle])

  // The startup cover in `index.html` belongs to the experience. Any other
  // page has nothing to fade in, so it goes as soon as that page renders.
  useEffect(() => {
    if (!isHome) revealStartupCover({ immediate: true })
  }, [isHome])

  return (
    <>
      {/* Every route. The homepage's own marks — the wordmark (back to the
          start) and the side navigation — move the CAMERA; this moves the
          visitor through the site, and was missing from the homepage between
          2026-09-14 and today: it was dropped when the closing frame took
          over those links there, and the closing frame was itself removed a
          day later. */}
      <GlobalNav variant={isHome ? 'home' : 'page'} />
      {isHome ? (
        // No fallback: the startup cover from `index.html` is already on
        // screen during the chunk fetch. If the chunk cannot be fetched at
        // all, the cover offers a retry rather than staying black forever.
        <LoadErrorBoundary name="Home" onError={showStartupFailure}>
          <Suspense fallback={null}>
            <Home />
          </Suspense>
        </LoadErrorBoundary>
      ) : (
        <BlankPage title={pageTitle ?? 'Page not found'} />
      )}
    </>
  )
}

export default function App() {
  return (
    <RouteProvider>
      <Routes />
    </RouteProvider>
  )
}
