/**
 * A single discreet serif wordmark, top-left — the one piece of literal
 * museum-exhibit typography this project adopts from the 2026-09-05
 * Musée-reference restraint pass (`creative-reference.md` §4A). Deliberately
 * NOT a navigation system: no links, no menu, nothing interactive — adding
 * one would cross into "persistent navigation bars or conventional website
 * chrome," which `creative-reference.md` §4 explicitly lists as a Don't.
 * `SectionIndicator.jsx` remains the only navigation surface.
 */
export default function SiteMark() {
  return (
    <div className="site-mark" aria-hidden="true">
      MGRT
    </div>
  )
}
