/**
 * How the Creative Table studio looks: every surface finish and atmosphere
 * setting in one place.
 *
 * Where things are is `studioLayout.js` (including the light fixtures); how
 * much of each light a stage uses is `stageBeats.js`. This file is the rest —
 * the values that are tuned by eye, together, against those lights.
 *
 * Texture `set`s are directories under `/textures`, each holding the three
 * files the scanned-texture loader reads (`materials/scannedStone.js`).
 * `tile` is the side of one repeat in metres, taken from each scan's own
 * recorded size. `tint` multiplies the scan's colour.
 */
export const LOOK = {
  exposure: 1.0,
  // What shows where there is no geometry: off the room's open front.
  background: '#060504',

  // Poly Haven "Plaster Grey 04", warmed.
  plaster: {
    set: 'studio/plaster',
    tile: 1.5,
    tint: '#eadccb',
    roughness: 1,
    normalScale: 0.75,
    // Slow, wall-sized drift in tone, baked into the walls' vertices: the
    // unevenness of a hand-finished wall, and what keeps a 1.5 m scan from
    // reading as a grid across a 9 m one.
    toneRange: [0.84, 1.08],
    // The scan's own stains would otherwise repeat in a grid every 1.5 m. Each
    // patch of wall is read from a different part of it instead
    // (`antiTiling.js`); this is how many patches fall in one repeat.
    patchScale: 0.7,
    // Where a wall meets a floor it is darker: scuffed, and shaded by the
    // floor itself. The plaster's tone falls to `tone` over the last `height`
    // metres of its surface, through the cove, so the wall arrives at the
    // dark concrete already most of the way there instead of stopping at it
    // as a bright edge.
    base: { height: 0.45, tone: 0.24 },
  },

  // Which finish the table has. 'stone' replaced the earlier 'walnut' on
  // 2026-10-22; the walnut is kept, complete, for comparison or reversal.
  tableFinish: 'stone',

  // ambientCG "Marble 024", honed. The top is one continuous slab: its repeat
  // is broken up across the 3.6 m top (`patchScale`), and the texture wraps
  // over the slab's edges so the stone reads as solid, not printed on.
  stone: {
    set: 'studio/stone',
    tile: 1.2,
    // Warm grey toward charcoal, never crushed to black.
    tint: '#625f5b',
    // The roughness map is already honed in the build (`build-studio-textures.mjs`).
    roughness: 1,
    // Fine surface detail only.
    normalScale: 0.2,
    // A broad, soft sheen from the studio interior, following the table key.
    reflections: 0.16,
    patchScale: 0.5,
  },

  // The table's frame under a stone top: blackened steel, satin.
  steel: {
    color: '#2b2926',
    roughness: 0.52,
    metalness: 0.85,
    reflections: 0.35,
  },

  // Poly Haven "European Walnut Veneer 05". The scan is a pale, nearly neutral
  // veneer; the tint is what makes it dark walnut, so it is deliberately a
  // strong orange-brown rather than a gentle correction.
  walnut: {
    set: 'studio/walnut',
    tile: 1.0,
    tint: '#7f6656',
    // Scales the scan's roughness: a satin finish, well short of gloss. Any
    // lower and the key light's reflection burns out a patch of the top in
    // the overhead view, where the camera looks straight down into it.
    roughness: 1.0,
    normalScale: 0.45,
    reflections: 0.1,
    // The top is read as a solid top is made: boards running its length,
    // glued edge to edge, every other one jointed end to end somewhere in its
    // middle (`jointRange`, metres from centre), and each length cut from a
    // different part of the tree — its own stretch of grain, a slightly
    // different colour, and a slightly different sheen (`walnutBoards.js`).
    boards: 8,
    jointRange: 0.6,
    boardTone: [0.93, 1.05],
    boardRoughness: [0.92, 1.08],
    // Legs and rails, each its own piece of wood.
    pieceTone: [0.88, 1.0],
    // Faces cut across the grain are darker, as end grain is.
    endGrainTone: 0.72,
  },

  // The original scene's scanned concrete, held dark.
  floor: {
    set: 'floors',
    tile: 4.2,
    tint: '#8d8780',
    roughness: 1,
    normalScale: 0.8,
    // A 4.2 m scan on a 9 x 7 m floor repeats about twice each way; broken
    // up the same way as the plaster.
    patchScale: 0.6,
    // Darker within `reach` metres of a wall, falling to `tone` at the cove:
    // the floor's half of the contact shading where the two meet.
    wallShade: { reach: 0.5, tone: 0.55 },
  },

  // PROVISIONAL finish for the wall lettering: aged bronze, satin.
  bronze: {
    color: '#6a4c30',
    roughness: 0.5,
    metalness: 1,
    reflections: 0.7,
  },

  // Never in frame; it only has to stop light.
  ceiling: '#1f1c1a',

  // Depth haze. Thin enough that the far wall darkens a little, no more.
  fog: { color: '#0a0807', density: 0.03 },

  // Motes in the light. Only visible inside a beam.
  dust: {
    count: 320,
    size: 0.009,
    brightness: 0.28,
    // The air they drift in: over the table and up the wall. [min], [max].
    volume: [
      [-2.6, 0.9, -2.2],
      [2.6, 3.4, 1.6],
    ],
  },
}
