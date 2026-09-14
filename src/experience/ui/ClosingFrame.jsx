import { useEffect, useRef, useState } from 'react'
import { RouteLink } from '../../router/Router.jsx'
import { requestNavigate } from '../timeline/sectionNavigationEvent.js'
import { endingLayers, endingProgress, isEndingInteractive } from '../timeline/endingSequence.js'

const SELECTED_WORK = [
  { key: 'film', label: 'Film' },
  { key: 'digital', label: 'Digital' },
  { key: 'campaigns', label: 'Campaigns' },
]

/**
 * The closing frame after Campaigns: the room darkens to warm charcoal and the
 * closing lines fade in over it. See `endingSequence.js` for how the sequence
 * is driven; this only draws it.
 *
 * Same pattern as `SectionIndicator.jsx`: the continuous value is read in a rAF
 * loop and written straight to CSS custom properties, and React state is kept
 * for the two rare flips — whether the frame exists at all, and whether its
 * links can be used.
 *
 * It sits below the wordmark and the side navigation (`z-index` 4 against
 * their 5), so they stay visible and clickable over the dark. Its links are
 * the homepage's site navigation — the top bar is not mounted there (see
 * `App.jsx`) — and every destination reuses what already exists: the site's
 * own /contact and /about routes, the side navigation's direct section
 * flights, and the wordmark's Back to start.
 */
export default function ClosingFrame() {
  const rootRef = useRef(null)
  const contentRef = useRef(null)
  const [active, setActive] = useState(false)
  const [interactive, setInteractive] = useState(false)
  const [workOpen, setWorkOpen] = useState(false)

  useEffect(() => {
    let rafId
    let lastE = -1
    let lastActive = false
    let lastInteractive = false
    const tick = () => {
      const e = endingProgress.value
      if (e !== lastE) {
        lastE = e
        const layers = endingLayers(e)
        const style = rootRef.current?.style
        if (style) {
          style.setProperty('--ending-edges', layers.edges.toFixed(4))
          style.setProperty('--ending-uniform', layers.uniform.toFixed(4))
          style.setProperty('--ending-text', layers.text.toFixed(4))
        }
        const nextActive = e > 0
        if (nextActive !== lastActive) {
          lastActive = nextActive
          setActive(nextActive)
        }
        const nextInteractive = isEndingInteractive()
        if (nextInteractive !== lastInteractive) {
          lastInteractive = nextInteractive
          setInteractive(nextInteractive)
          if (!nextInteractive) {
            setWorkOpen(false)
            // Keyboard focus inside a frame that is going away would fall back
            // to the document; hand it to the wordmark, the one control that
            // is always there, instead.
            if (contentRef.current?.contains(document.activeElement)) {
              document.querySelector('.site-mark')?.focus({ preventScroll: true })
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div className="closing-frame" ref={rootRef} hidden={!active}>
      <div className="closing-frame__veil closing-frame__veil--edges" aria-hidden="true" />
      <div className="closing-frame__veil" aria-hidden="true" />

      <section
        ref={contentRef}
        className={`closing-frame__content${interactive ? ' closing-frame__content--interactive' : ''}`}
        aria-labelledby="closing-frame-title"
        // React 18 has no boolean `inert`; the empty string sets the attribute.
        inert={interactive ? undefined : ''}
      >
        <p className="closing-frame__mark">MGRT Media</p>
        <h2 id="closing-frame-title" className="closing-frame__title">
          <span className="closing-frame__line">Have something in mind?</span>
          <span className="closing-frame__line closing-frame__line--second">Let’s make it happen.</span>
        </h2>

        <RouteLink href="/contact" className="closing-frame__primary">
          Start a project<span className="closing-frame__arrow" aria-hidden="true">↗</span>
        </RouteLink>

        <nav className="closing-frame__nav" aria-label="Closing">
          <ul className="closing-frame__links">
            <li>
              <button
                type="button"
                className="global-nav__link closing-frame__link"
                aria-expanded={workOpen}
                aria-controls="closing-frame-work"
                onClick={() => setWorkOpen((open) => !open)}
              >
                Selected work
              </button>
            </li>
            <li>
              <RouteLink href="/about" className="global-nav__link closing-frame__link">
                About
              </RouteLink>
            </li>
            <li>
              <button type="button" className="global-nav__link closing-frame__link" onClick={() => requestNavigate('intro')}>
                Back to start
              </button>
            </li>
          </ul>

          <ul id="closing-frame-work" className="closing-frame__links closing-frame__links--work" hidden={!workOpen}>
            {SELECTED_WORK.map((section) => (
              <li key={section.key}>
                <button
                  type="button"
                  className="global-nav__link closing-frame__link"
                  onClick={() => requestNavigate(section.key)}
                >
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </div>
  )
}
