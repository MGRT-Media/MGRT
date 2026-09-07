import { Suspense, lazy, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { CAMPAIGNS_SWAP_T } from '../timeline/filmActBeats.js'

/**
 * Holds Act 3 out of the initial load.
 *
 * The exterior world and the billboard were mounted with everything else, so
 * a visitor who never scrolled past the opening room still paid for three GLBs
 * they would not see for another 83% of the sequence — plus the code that
 * builds the road, the traffic, the river and the night sky. On the opening
 * frame, which is the one that has to feel immediate, all of that is dead
 * weight.
 *
 * `lazy` puts that code in its own chunk and the gate below decides when to
 * fetch it, so neither the JS nor the models are requested until the camera is
 * actually on its way there.
 */
const Billboard = lazy(() => import('./Billboard.jsx'))
const ExteriorEnvironment = lazy(() => import('./ExteriorEnvironment.jsx'))

/**
 * How far ahead of the hand-over to start loading.
 *
 * The point is that the assets are already resident by the time the swap
 * happens — arriving at `CAMPAIGNS_SWAP_T` and only then requesting them would
 * trade an initial-load cost for a visible stall at the worst possible moment,
 * mid-transition. 0.14 of the timeline is a long way at scroll speed, and the
 * cost of being early is only that some visitors fetch assets they don't reach.
 */
const PRELOAD_LEAD = 0.14

/**
 * Once armed, this never disarms. Unmounting on the way back would dispose
 * geometry and textures that a visitor scrolling up and down across the
 * hand-over would then have to re-fetch and re-parse repeatedly — and the
 * billboard's render-to-texture handshake depends on its target existing
 * before the swap, not being rebuilt at it.
 */
export default function CampaignsGate() {
  const [armed, setArmed] = useState(false)

  // The one place React state is the right tool rather than the direct
  // mutation technical-architecture.md §7 calls for: this is a single
  // transition that has to add nodes to the tree, not a per-frame value.
  useFrame(() => {
    if (!armed && scrollProgress.value >= CAMPAIGNS_SWAP_T - PRELOAD_LEAD) setArmed(true)
  })

  if (!armed) return null

  return (
    <Suspense fallback={null}>
      <Billboard />
      <ExteriorEnvironment />
    </Suspense>
  )
}
