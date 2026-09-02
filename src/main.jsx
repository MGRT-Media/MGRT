import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'

// Always start at the top on load/refresh — the cinematic timeline's own
// progress (ScrollTimelineProvider.jsx) assumes scroll position 0 means
// "the dark intro start," so a browser-restored mid-scroll position on
// reload would desync the mounted camera/lighting state (all defaulted to
// t: 0) from the real scroll offset Lenis/GSAP ScrollTrigger measure on
// init. `scrollRestoration` must be set before the browser has a chance to
// restore anything; the explicit `scrollTo` covers browsers that already
// did before this module ran.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}
window.scrollTo(0, 0)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
