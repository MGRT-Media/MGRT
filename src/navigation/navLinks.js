/**
 * The single source of truth for global navigation. Desktop, the mobile
 * drop-down and the internal-page header all read this list, so a route is
 * added or renamed in exactly one place.
 *
 * `label` is the full wordmark-style name used on the cinematic homepage and
 * in the mobile menu; `compact` is the shortened form the internal pages use
 * (§8 of the navigation spec), where the MGRT mark already occupies the
 * top-left and the header should stay quieter still.
 */
export const NAV_LINKS = [
  { href: '/work', label: 'Selected Work', compact: 'Work' },
  { href: '/about', label: 'About', compact: 'About' },
  { href: '/contact', label: 'Contact', compact: 'Contact' },
]

/** Route path -> the page identifier the blank pages render for now. */
export const PAGE_TITLES = {
  '/work': 'Selected Work',
  '/about': 'About',
  '/contact': 'Contact',
}
