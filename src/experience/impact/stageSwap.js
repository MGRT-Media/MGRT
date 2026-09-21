/**
 * Which set is on screen: the room, or the Impact table.
 *
 * The two are never drawn together. They occupy the same volume — the table
 * is placed directly under the hero camera, inside the room (see
 * `impactStage.js`) — and the handoff between them happens on the single frame
 * where the print exactly fills the viewport carrying a still of the room. So
 * the swap is a hard cut with nothing to blend, and the correctness condition
 * is only that both sides change on the SAME frame.
 *
 * Hiding the room group also puts out the room's lights: they live inside it
 * (`Environment` -> `VolumetricLightingRig`), and three.js does not collect
 * lights under an invisible object. That is deliberate rather than incidental
 * — the table has to be lit by its own key alone, or the room's sun would go
 * on lighting a table that is supposed to be somewhere else.
 *
 * Plain mutable module state, like `journeyProgress.js`: written once per
 * change by `ScrollCameraRig`, never React state.
 */

export const stageSwap = {
  /** Set by `CinematicExperience` on mount. */
  room: null,
  impact: null,
  /** True while the Impact set is the one being drawn. */
  onImpact: false,
}

/** Shows one set and hides the other. Returns true if this changed anything. */
export function showImpact(next) {
  if (stageSwap.onImpact === next) return false
  stageSwap.onImpact = next
  if (stageSwap.room) stageSwap.room.visible = !next
  if (stageSwap.impact) stageSwap.impact.visible = next
  return true
}
