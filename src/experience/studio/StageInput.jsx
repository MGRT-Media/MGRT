import { useEffect } from 'react'
import { isExperienceRevealed, onExperienceRevealed, takeStartupIntent } from '../loading/startupCover.js'
import { onNavigateRequest } from '../timeline/sectionNavigationEvent.js'
import { LAST_STAGE } from './stageBeats.js'
import { goToStage, stepStage } from './stageNavigation.js'

// How far a wheel or a finger has to travel before it counts as intent, so a
// resting hand or a stray notch does not move the camera.
const WHEEL_THRESHOLD = 50
const SWIPE_THRESHOLD_PX = 50

// A wheel gesture is over once the wheel has been quiet this long. A trackpad
// flick keeps sending events as it coasts, and those must stay part of the
// gesture that started them rather than becoming the next one.
const WHEEL_GESTURE_GAP_MS = 140

const FORWARD_KEYS = new Set(['ArrowDown', 'PageDown', ' '])
const BACKWARD_KEYS = new Set(['ArrowUp', 'PageUp'])

/**
 * Turns wheel, touch and keyboard input into stage steps: one intentional
 * gesture moves one stage, forward or back.
 *
 * The page does not scroll. A stage is a state rather than a scroll position,
 * so there is no scroll range for a resize to distort and nothing for a
 * coasting trackpad to overshoot.
 */
export default function StageInput() {
  useEffect(() => {
    let wheelTravel = 0
    let wheelSpent = false
    let wheelGapTimer = 0
    let touchStartY = null

    const endWheelGesture = () => {
      wheelTravel = 0
      wheelSpent = false
    }

    const onWheel = (event) => {
      event.preventDefault()
      if (!isExperienceRevealed()) return
      clearTimeout(wheelGapTimer)
      wheelGapTimer = setTimeout(endWheelGesture, WHEEL_GESTURE_GAP_MS)
      if (wheelSpent) return
      wheelTravel += event.deltaY
      if (Math.abs(wheelTravel) < WHEEL_THRESHOLD) return
      wheelSpent = true
      stepStage(Math.sign(wheelTravel))
    }

    const onTouchStart = (event) => {
      touchStartY = event.touches.length === 1 ? event.touches[0].clientY : null
    }

    const onTouchMove = (event) => {
      // Also what stops the browser's own pull-to-refresh and rubber-banding.
      if (event.cancelable) event.preventDefault()
      if (touchStartY === null || !isExperienceRevealed()) return
      const travel = touchStartY - event.touches[0].clientY
      if (Math.abs(travel) < SWIPE_THRESHOLD_PX) return
      // One step per touch: spent until the finger lifts.
      touchStartY = null
      stepStage(Math.sign(travel))
    }

    const onKeyDown = (event) => {
      if (!isExperienceRevealed()) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      // A focused control keeps its own keys: Space presses a button.
      if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea')) return
      if (FORWARD_KEYS.has(event.key)) stepStage(1)
      else if (BACKWARD_KEYS.has(event.key)) stepStage(-1)
      else if (event.key === 'Home') goToStage(0)
      else if (event.key === 'End') goToStage(LAST_STAGE)
      else return
      event.preventDefault()
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onKeyDown)

    // The wordmark's "back to start".
    const stopNavigation = onNavigateRequest((key) => {
      if (key === 'intro') goToStage(0)
    })

    // A scroll made while the scene was still loading: one step, not lost.
    const stopReveal = onExperienceRevealed(() => {
      if (takeStartupIntent()?.type === 'forward') stepStage(1)
    })

    return () => {
      clearTimeout(wheelGapTimer)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKeyDown)
      stopNavigation()
      stopReveal()
    }
  }, [])

  return null
}
