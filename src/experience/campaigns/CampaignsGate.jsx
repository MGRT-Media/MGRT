import { Suspense, lazy, useEffect, useState } from 'react'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { HERO_T } from './../timeline/cameraPath.js'

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

  /**
   * Polled on `requestAnimationFrame`, deliberately not on R3F's `useFrame`.
   *
   * The `useFrame` version of this never ran. The component mounted — verified
   * with a probe — but its callback was never invoked, so the gate sat closed
   * however far the visitor scrolled. `DepthOfField` takes the render loop over
   * at priority 1, and a subscription added afterwards on a component that
   * renders nothing did not get driven.
   *
   * This does not need the render loop anyway. It is watching a scalar and
   * flipping one piece of state once; rAF is the plainer tool and owes nothing
   * to R3F's scheduling. It also stops as soon as it has armed, so it costs a
   * comparison per frame for the first part of the sequence and nothing after.
   */
  useEffect(() => {
    if (armed) return undefined
    let handle = 0
    const check = () => {
      if (scrollProgress.value >= HERO_T - PRELOAD_LEAD) {
        setArmed(true)
        return
      }
      handle = requestAnimationFrame(check)
    }
    handle = requestAnimationFrame(check)
    return () => cancelAnimationFrame(handle)
  }, [armed])

  if (!armed) return null

  return (
    <Suspense fallback={null}>
      <Billboard />
      <ExteriorEnvironment />
    </Suspense>
  )
}
