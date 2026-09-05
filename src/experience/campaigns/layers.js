import { useLayoutEffect, useRef } from 'react'

/**
 * Layer separation for the Campaigns act.
 *
 * Everything built before this act (Environment, CinemaCamera, Monitor and
 * all the interior lighting) stays on Three's default layer 0, untouched.
 * The billboard surface and the exterior highway world go on layer 1.
 *
 * Two things depend on that split:
 *
 * 1. The billboard's render-to-texture camera only ever enables layer 0, so
 *    it renders the real, live interior and cannot see the billboard it is
 *    feeding. Feedback/recursion is impossible by construction rather than
 *    by a guard.
 * 2. `CampaignsLayerSwitch.jsx` swaps the MAIN camera between the two
 *    layers at `CAMPAIGNS_SWAP_T`. Before that instant the audience sees
 *    the genuine room; after it, the billboard showing that same room live.
 *    Because the two images coincide exactly at the swap (see
 *    `Billboard.jsx`), the change is invisible.
 *
 * Lights need explicit layer assignment too: Three intersects a light's
 * layers against an object's layers when deciding what it illuminates, so
 * an exterior light left on the default layer would light the interior as
 * well (and vice versa).
 */
export const EXTERIOR_LAYER = 1

/**
 * Ref that moves an object — and everything mounted under it — onto the
 * exterior layer. Re-traverses on every render rather than only on mount,
 * so children that attach after their parent (React commits child refs
 * before the parent's) are always caught; the subtrees involved are a
 * handful of meshes, so the cost is irrelevant next to the risk of one
 * object silently staying on the interior layer.
 */
export function useExteriorLayer() {
  const ref = useRef(null)
  useLayoutEffect(() => {
    ref.current?.traverse((child) => child.layers.set(EXTERIOR_LAYER))
  })
  return ref
}
