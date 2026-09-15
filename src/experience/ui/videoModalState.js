/**
 * Whether the full-screen video pop-up is open. Set by
 * `FullscreenVideoModal.jsx` for as long as it is mounted, and read in rAF
 * loops by overlays that should step aside while it plays (`FilmCaption.jsx`),
 * the same plain-object pattern as `scrollProgress`.
 */
export const videoModalState = { open: false }
