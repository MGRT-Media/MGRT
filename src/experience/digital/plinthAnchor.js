import { COMPOSITION_ANCHOR } from '../lighting/volumetricLighting.js'

/**
 * Shared spatial anchor for the Phase 2 Digital composition — the single
 * source of truth for where the Cinema Camera's and Monitor's SEPARATE
 * stands sit relative to each other and to the light beam. Each object
 * owns its own dedicated stand (Monitor: a stone plinth; Cinema Camera:
 * a quadrupod, per explicit request — see `CinemaCamera.jsx`) rather than
 * sharing one — this module only holds what still needs to stay in sync
 * between them: the common beam center/yaw both stands are built around,
 * and each stand's own local-X offset from that center.
 *
 * `BEAM_CENTER` stays exactly the value it has held since Phase 1D. It used
 * to come from `lightingParams.spot.target`, the artificial spotlight's aim
 * point; that light no longer exists, but the composition it anchored is
 * approved, so the number moved to `COMPOSITION_ANCHOR` and is imported from
 * there instead. Same array, same coordinates, nothing here has moved.
 */
export const BEAM_CENTER = COMPOSITION_ANCHOR
export const YAW_DEGREES = 20

// Each stand's own footprint and its local-X offset from BEAM_CENTER
// (along the shared yaw's own local axis, not raw world X). Offsets are
// asymmetric with each stand's half-width so the two stands sit close
// beside each other with a real but modest gap, rather than centered
// exactly opposite each other regardless of size.
// offsetX widened from 0.55 to 0.85 (and CAMERA_STAND's mirrored below),
// per explicit direction that the Cinema Camera and Monitor read as two
// distinct destinations within one production world, not two props placed
// beside each other — "the visitor should subconsciously understand
// there is somewhere else in this room." The room easily accommodates the
// wider gap (SHELL_WIDTH 14, and both objects still sit well inside the
// establish shot's frame — verified visually after the change).
export const MONITOR_PLINTH = {
  width: 1.0,
  depth: 0.75,
  height: 0.72,
  offsetX: 0.85,
}

// The Cinema Camera no longer stands on a stone plinth — per explicit
// request it now sits on its own sleek 4-legged stand (quadrupod),
// defined in `CinemaCamera.jsx`. `standHeight` is the height of that
// stand's top platform (where the camera body sits), kept close to
// `MONITOR_PLINTH.height` so the two objects read at a comparable scale
// beside each other despite their very different support structures.
export const CAMERA_STAND = {
  offsetX: -0.85,
  standHeight: 0.7,
}
