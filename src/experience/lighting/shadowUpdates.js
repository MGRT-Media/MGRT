/**
 * The room's shadow map is drawn when it changes, not every frame.
 *
 * The sun is a `DirectionalLight` at a fixed position with a fixed orthographic
 * shadow camera, and everything that casts into it — the shell, the columns,
 * the two props on their stands — is static. So every frame was re-rendering
 * 157 draw calls and 1.20M triangles into a 4096x4096 depth map to produce the
 * identical image it produced last frame: measured as roughly a third of the
 * frame's GPU time.
 *
 * `renderer.shadowMap.autoUpdate` is therefore turned off once the scene is
 * built, after one last update, and the map is reused from then on. Nothing
 * about the shadow's appearance changes: the same map, drawn by the same pass,
 * simply stops being redrawn.
 *
 * If shadow-casting geometry ever does change — a model that arrives late, an
 * object added for a future act — call `requestShadowUpdate()`. The next frame
 * redraws the map once and then freezes again, which keeps the exception
 * explicit rather than returning the whole experience to continuous updates.
 */

let pending = true
let frozen = false
let armed = false
/** DEV only: the renderer last seen by `applyShadowUpdates`, for the handle below. */
let lastRenderer = null

/**
 * Called once the room is fully built (`SceneReady`). Until then the renderer
 * keeps its normal per-frame updates, so geometry still arriving — the two
 * props on their stands — is in the map before it is held.
 */
export function armShadowFreeze() {
  armed = true
}

/** Ask for one more shadow-map render on the next frame. */
export function requestShadowUpdate() {
  pending = true
}

/**
 * Called every frame by the lighting rig, which owns a renderer reference.
 * Keeps the renderer's shadow state in step with the requests above.
 */
export function applyShadowUpdates(renderer) {
  if (import.meta.env.DEV) lastRenderer = renderer
  if (!armed) return
  if (!frozen) {
    // One clean update with the whole room present, then hold it.
    renderer.shadowMap.autoUpdate = false
    frozen = true
    pending = true
  }
  if (pending) {
    renderer.shadowMap.needsUpdate = true
    pending = false
  }
}

/**
 * Dev-only handle, matching `window.__sp`/`window.__lights` elsewhere: the
 * shadow state is a module-local detail with no React presence, so this is the
 * only way to read it from a running page.
 */
if (import.meta.env.DEV) {
  window.__shadow = {
    state: () => ({ armed, frozen, pending }),
    invalidate: requestShadowUpdate,
    /** Puts the renderer back on continuous updates, to measure what freezing saves. */
    setAuto: (auto) => {
      if (!lastRenderer) return false
      frozen = !auto
      armed = !auto ? armed : false
      lastRenderer.shadowMap.autoUpdate = auto
      if (auto) lastRenderer.shadowMap.needsUpdate = true
      return true
    },
  }
}

/** A remount (returning from an internal page) builds a new renderer and scene. */
export function resetShadowUpdates() {
  pending = true
  frozen = false
  armed = false
}
