import { lightingParams } from '../lighting/volumetricLighting.js'

/**
 * Shared composition anchor for the Phase 2 Digital plinth — the single
 * source of truth for the plinth's size, position, and rotation, plus the
 * local-space offset that separates the Cinema Camera and Monitor across
 * it. `Monitor.jsx`, `CinemaCamera.jsx`, and `DigitalPlinth.jsx` all read
 * from here rather than each hard-coding the shared transform, so moving
 * or resizing the plinth can't let the two objects and their support
 * silently drift out of sync with each other.
 *
 * `PLINTH_CENTER` stays exactly `lightingParams.spot.target` — the
 * light's own floor target, unchanged from Phase 1D — so the whole
 * two-object composition remains physically grounded within the primary
 * beam by construction, not by hand-tuned coincidence.
 */
export const PLINTH = {
  // Widened from Phase 1D's single-object 1.0 x 0.75 footprint to
  // comfortably hold both objects side by side, per explicit request.
  width: 1.9,
  depth: 0.85,
  height: 0.72,
}

export const PLINTH_YAW_DEGREES = 20
export const PLINTH_CENTER = lightingParams.spot.target
export const PLINTH_TOP_Y = PLINTH.height

// Half-separation along the plinth's own local X axis: Monitor sits at
// +OBJECT_OFFSET_X, Cinema Camera at -OBJECT_OFFSET_X, so the pair reads
// as a balanced two-object composition centered on the light's floor
// target rather than either one centered alone.
export const OBJECT_OFFSET_X = 0.5
