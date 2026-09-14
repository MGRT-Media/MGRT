import { Suspense, lazy, useEffect } from 'react'
import { RouteProvider, useRoute } from './router/Router.jsx'
import GlobalNav from './navigation/GlobalNav.jsx'
import { PAGE_TITLES } from './navigation/navLinks.js'
import BlankPage from './pages/BlankPage.jsx'

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

  return (
    <>
      {/* Internal pages only. On the homepage the closing frame's own links
          (`ClosingFrame.jsx`) and the wordmark carry the site navigation. */}
      {!isHome && <GlobalNav />}
      {isHome ? (
        // No fallback: the homepage opens on darkness, and the page
        // background is already that same void, so an empty frame during the
        // chunk fetch reads as the start of the experience rather than as a
        // loading state.
        <Suspense fallback={null}>
          <Home />
        </Suspense>
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
