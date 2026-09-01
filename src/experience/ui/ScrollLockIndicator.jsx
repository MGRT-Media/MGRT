import { useEffect, useState } from 'react'
import { onScrollLock, onScrollUnlock } from '../timeline/scrollLockEvent.js'
import { SCROLL_LOCK_HOLD_MS } from '../timeline/filmActBeats.js'

const RADIUS = 18
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * The Force-Stop visual/tactile cue (build-workflow.md's "communicate to
 * the user that they are locked onto an active focal point"), per
 * explicit request — a minimal ring that fills over the hold duration so
 * the visitor can see, not just feel, that the pause is intentional and
 * temporary rather than the site hanging. A plain DOM overlay, not a 3D
 * object — per technical-architecture.md §4's DOM/WebGL separation, it
 * lives outside the Canvas and reacts to `scrollLockEvent.js`'s pub/sub
 * with ordinary `useState` (a rare, occasional boolean flip, not a
 * per-frame value — see that module's own note on why this is a
 * reasonable exception to "no React state for scroll-driven values").
 */
export default function ScrollLockIndicator() {
  const [visible, setVisible] = useState(false)
  // Incremented on every lock so the <svg key={cycle}> below remounts —
  // the reliable way to restart a CSS keyframe animation from its start
  // even if a new lock engages before a previous fade-out finished.
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    const offLock = onScrollLock(() => {
      setVisible(true)
      setCycle((c) => c + 1)
    })
    const offUnlock = onScrollUnlock(() => setVisible(false))
    return () => {
      offLock()
      offUnlock()
    }
  }, [])

  return (
    <div
      className={`scroll-lock-indicator${visible ? ' scroll-lock-indicator--visible' : ''}`}
      aria-hidden="true"
    >
      <svg key={cycle} width="48" height="48" viewBox="0 0 48 48">
        <circle className="scroll-lock-indicator__track" cx="24" cy="24" r={RADIUS} />
        <circle
          className="scroll-lock-indicator__sweep"
          cx="24"
          cy="24"
          r={RADIUS}
          style={{
            '--circumference': CIRCUMFERENCE,
            strokeDasharray: CIRCUMFERENCE,
            animationDuration: `${SCROLL_LOCK_HOLD_MS}ms`,
          }}
        />
      </svg>
    </div>
  )
}
