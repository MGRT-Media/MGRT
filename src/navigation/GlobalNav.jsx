import { useEffect, useRef, useState } from 'react'
import { RouteLink, useRoute } from '../router/Router.jsx'
import { NAV_LINKS } from './navLinks.js'

/**
 * Persistent site navigation — the second, entirely separate navigation
 * system in this project.
 *
 * `SectionIndicator.jsx` (left edge) moves the camera through the cinematic
 * homepage; this moves the visitor through the actual website. They share no
 * state, no styling and no code by design, and this one lives wholly in the
 * DOM: it is mounted outside the lazily-loaded homepage, never touches the
 * Three.js scene, and so is painted immediately on load and stays fixed while
 * the camera travels.
 *
 * Desktop and mobile render from the same `NAV_LINKS` list. Only one of the
 * two is ever in the document's accessibility tree — the breakpoint swaps
 * them with `display: none`, not opacity — so a screen reader is never
 * offered the same three links twice.
 *
 * `variant`:
 *   'home' — the cinematic homepage. Links only; no mark, because the MGRT
 *            identity is discovered through the opening sequence.
 *   'page' — internal pages. Adds the MGRT mark linking back to '/', and
 *            shortens "Selected Work" to "Work".
 */
export default function GlobalNav({ variant = 'home' }) {
  const [isOpen, setIsOpen] = useState(false)
  const leadRef = useRef(null)
  const path = useRoute()
  const isPage = variant === 'page'

  // Outside tap and Escape both close. Only bound while open, so the closed
  // menu costs nothing.
  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event) => {
      if (!leadRef.current?.contains(event.target)) setIsOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  return (
    <>
      {/*
        Top-left cluster: the mobile menu control, the internal-page mark,
        and the drop-down the control reveals. Grouped in one element so the
        outside-tap check above is a single `contains` test, and so the mark
        and the control sit side by side on mobile rather than overlapping.
      */}
      <div className="global-nav-lead" ref={leadRef}>
        <div className="global-nav-lead__row">
          <button
            type="button"
            className={`global-nav__toggle${isOpen ? ' global-nav__toggle--open' : ''}`}
            aria-expanded={isOpen}
            aria-controls="global-nav-menu"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsOpen((open) => !open)}
          >
            <span className="global-nav__bar" />
            <span className="global-nav__bar" />
            <span className="global-nav__bar" />
          </button>

          {isPage && (
            <RouteLink href="/" className="global-nav__mark">
              MGRT
            </RouteLink>
          )}
        </div>

        <nav
          id="global-nav-menu"
          className={`global-nav__drop${isOpen ? ' global-nav__drop--open' : ''}`}
          aria-label="Site"
        >
          <ul className="global-nav__drop-list">
            {NAV_LINKS.map((link, index) => (
              <li
                key={link.href}
                className="global-nav__drop-item"
                /* Drives the reveal stagger in CSS — one custom property
                   instead of three near-identical delay rules. */
                style={{ '--stagger-index': index }}
              >
                <RouteLink
                  href={link.href}
                  className="global-nav__link"
                  aria-current={path === link.href ? 'page' : undefined}
                  onNavigate={() => setIsOpen(false)}
                >
                  {link.label}
                </RouteLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Top-right horizontal navigation. Desktop only. */}
      <nav className="global-nav" aria-label="Site">
        <ul className="global-nav__list">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <RouteLink
                href={link.href}
                className="global-nav__link"
                aria-current={path === link.href ? 'page' : undefined}
              >
                {isPage ? link.compact : link.label}
              </RouteLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
