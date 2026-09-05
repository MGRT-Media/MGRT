/**
 * Global film-grain overlay — a single static DOM layer, not a WebGL
 * post-process pass, per the 2026-09-05 Musée-reference restraint pass
 * (`creative-reference.md` §4A: "cheap, global, non-WebGL overlay
 * (CSS/SVG), never inside the render pipeline"). Sits above the canvas
 * and every floating UI mark (matching how film grain covers an entire
 * frame, chrome included) but below `FullscreenVideoModal.jsx` — a full
 * transport control should read clean, not textured.
 *
 * Pure CSS/SVG, no React state, no per-frame cost: the animation is a
 * `steps()` background-position cycle the browser compositor drives on
 * its own. See `global.css`'s `.grain-overlay` for the implementation and
 * its `prefers-reduced-motion` handling (frozen, not removed — grain
 * carries texture, not motion information).
 */
export default function GrainOverlay() {
  return <div className="grain-overlay" aria-hidden="true" />
}
