/**
 * Which homepage scene this page load runs.
 *
 * The default (undefined) is the original experience. `?scene=creative-table`
 * selects the Creative Table redesign while it is being built; `index.html`
 * reads the query before anything else runs and records it on `<html>`, so the
 * startup cover, the preload hints and this module all agree.
 *
 * Read once: the choice holds for the whole page load, including client-side
 * navigation to an internal page and back.
 */
export const CREATIVE_TABLE_SCENE = 'creative-table'

export const selectedScene = document.documentElement.dataset.scene
