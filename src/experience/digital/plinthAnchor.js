import { lightingParams } from '../lighting/volumetricLighting.js'

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
 * `BEAM_CENTER` stays exactly `lightingParams.spot.target` — the light's
 * own floor target, unchanged since Phase 1D — so both stands remain
 * physically grounded within the primary beam by construction.
 */
export const BEAM_CENTER = lightingParams.spot.target
export const YAW_DEGREES = 20

// Each stand's own footprint and its local-X offset from BEAM_CENTER
// (along the shared yaw's own local axis, not raw world X). Offsets are
// asymmetric with each stand's half-width so the two stands sit close
// beside each other with a real but modest gap, rather than centered
// exactly opposite each other regardless of size.
export const MONITOR_PLINTH = {
  width: 1.0,
  depth: 0.75,
  height: 0.72,
  offsetX: 0.55,
}

// The Cinema Camera no longer stands on a stone plinth — per explicit
// request it now sits on its own sleek 4-legged stand (quadrupod),
// defined in `CinemaCamera.jsx`. `standHeight` is the height of that
// stand's top platform (where the camera body sits), kept close to
// `MONITOR_PLINTH.height` so the two objects read at a comparable scale
// beside each other despite their very different support structures.
export const CAMERA_STAND = {
  offsetX: -0.55,
  standHeight: 0.7,
}
