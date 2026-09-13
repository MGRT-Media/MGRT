import * as THREE from 'three'
import { HERO_T, HERO_COUNTDOWN_MS, HERO_REVEAL_SECONDS } from './filmActBeats.js'

/**
 * The Digital -> hero -> billboard sequence, as an explicit state machine.
 *
 * **Why a machine and not more progress maths.** Every previous attempt at the
 * hero pause tried to express it as a function of scroll progress — a plateau
 * in the mapping, then a gate that pinned progress while scroll accumulated
 * underneath. Both failed for the same structural reason: the camera is
 * rendered from `sampleCameraPath(scrollProgress.value)`, so whatever those
 * layers computed, the rig still drew whatever progress said. Nothing owned
 * the rendered transform, so nothing could actually stop it.
 *
 * This owns it. `ScrollCameraRig` asks this module what to draw, and during
 * the hold the answer is the canonical hero transform regardless of what
 * scroll, Lenis, ScrollTrigger or GSAP are doing. Progress is an INPUT here,
 * never an authority.
 *
 * **The states**
 *
 *  - `TRAVEL`   — scroll drives the camera, but the sampled progress is
 *                 CLAMPED at `HERO_T`. This one clamp is what fixes the bug:
 *                 no amount of forward scroll can render a frame past the
 *                 hero, so the pull-back cannot start early no matter how the
 *                 scroller behaves.
 *  - `HERO_HOLD`— the transform is frozen at the canonical hero pose and a
 *                 real 1500ms clock runs. Scroll is read only to detect a
 *                 deliberate reverse.
 *  - `REVEAL`   — the pull-back, driven by its own clock from exactly
 *                 `HERO_T`, so accumulated scroll cannot jump it forward and
 *                 it always starts cleanly from the beginning.
 *  - `IMPACT`   — settled; scroll takes over again for reverse navigation.
 *  - `RETURN`   — the pull-back played backwards on the same clock, still on
 *                 the exterior, until the camera is back on the hero pose.
 */

export const HERO_STATE = {
  TRAVEL: 'TRAVEL',
  HERO_HOLD: 'HERO_HOLD',
  REVEAL: 'REVEAL',
  IMPACT: 'IMPACT',
  RETURN: 'RETURN',
}

/** The hold, in real milliseconds. Not derived from scroll distance. */
export const HERO_HOLD_MS = HERO_COUNTDOWN_MS

/**
 * How close the damped camera must be to the hero before the clock starts.
 *
 * The freeze happens when the camera has ARRIVED, not when progress crosses
 * the line — the rig damps, so a fast scroll is still gliding at the crossing
 * and freezing there would snap. Two centimetres at this room's scale, far
 * below anything visible at the hero's stand-off.
 */
const ARRIVAL_EPSILON = 0.02

/**
 * How far back below the hero counts as a deliberate reverse.
 *
 * Generous enough that scroll jitter or a trackpad's inertial settle cannot
 * cancel the beat by accident.
 */
const REVERSE_CANCEL_DRIFT = 0.035

/** How far below the hero counts as a genuine re-approach, re-arming the beat. */
const REARM_BELOW = 0.12

const state = {
  phase: HERO_STATE.TRAVEL,
  /**
   * True once the forward beat has played. Reverse must not replay it, and
   * scrolling forward again straight afterwards must not stall at the hero —
   * so this both suppresses the hold and lets a re-entry skip to the reveal.
   */
  holdConsumed: false,
  holdStartedAt: 0,
  /** The clocked exterior move shared by `REVEAL` and `RETURN`. */
  moveFrom: HERO_T,
  moveStartedAt: 0,
  moveDurationMs: 0,
  /** Called once a requested `RETURN` has handed the camera back to the interior. */
  onReturned: null,
  /**
   * True from a requested return's hand-over until scroll is actually below
   * the hero. The jump that follows starts from the bottom of the page, so for
   * its first few frames raw progress still reads past the hero — without this
   * `TRAVEL` would take that as a fresh arrival and start the reveal again.
   */
  leavingHero: false,
  /** What the rig should sample the path at this frame. */
  progress: 0,
}

/** Effective progress — what the camera is actually drawn from. */
export const renderedProgress = { value: 0 }

/**
 * Where the camera actually IS along the path this frame: `renderedProgress`
 * after `ScrollCameraRig`'s easing. Anything that has to stay in step with
 * what the viewer sees — rather than with where scroll is heading — reads this.
 */
export const cameraProgress = { value: 0 }

export function heroPhase() {
  return state.phase
}

/** True while the transform must be written verbatim rather than damped. */
export function isHeroFrozen() {
  return state.phase === HERO_STATE.HERO_HOLD
}

/**
 * Whether the EXTERIOR is what the camera should be seeing.
 *
 * This is the swap, and it belongs to the state machine rather than to a
 * progress threshold. The previous test was `renderedProgress >= HERO_T`,
 * which looks right and is badly wrong: during the hold the machine pins
 * rendered progress to exactly `HERO_T`, so `>= HERO_T` was true from the
 * FIRST FRAME of the hold. The viewer spent the entire 1.5 seconds looking at
 * the billboard, and the reveal had nothing left to reveal.
 *
 * A threshold cannot tell "arrived at the hero" apart from "past the hero".
 * A state can. The interior stays active through `TRAVEL` and the whole of
 * `HERO_HOLD`; the exterior only exists from the instant the pull-back begins.
 */
export function isExteriorActive() {
  return state.phase === HERO_STATE.REVEAL || state.phase === HERO_STATE.IMPACT || state.phase === HERO_STATE.RETURN
}

/**
 * Starts a clocked exterior move from the progress drawn last frame.
 *
 * The duration is the reveal's, scaled by how much of the pull-back is left to
 * cover, so a move reversed part-way takes only the time its distance needs.
 */
function startExteriorMove(phase, to, now) {
  state.phase = phase
  state.moveFrom = state.progress
  state.moveStartedAt = now
  state.moveDurationMs = (HERO_REVEAL_SECONDS * 1000 * Math.abs(to - state.moveFrom)) / (1 - HERO_T)
}

function exteriorMoveProgress(to, now) {
  const t = state.moveDurationMs > 0 ? THREE.MathUtils.clamp((now - state.moveStartedAt) / state.moveDurationMs, 0, 1) : 1
  const eased = t * t * (3 - 2 * t)
  return { t, progress: THREE.MathUtils.lerp(state.moveFrom, to, eased) }
}

/**
 * Takes the camera from the exterior back to the hero before anything below it.
 *
 * Reverse used to swap to the interior on the raw scroll crossing. A section
 * jump sweeps the whole pull-back in about a tenth of a second, so the damped
 * camera was still out beside the highway when the room layer came on — the
 * visitor saw the room from outside its walls, lit by the day sky, and then
 * flew in through the back wall. The swap is only invisible from the hero
 * pose, so reverse now mirrors forward: the pull-back runs backwards on its own
 * clock, and the interior returns once the camera has actually arrived.
 *
 * Returns false when the exterior is not showing, so the caller can go ahead.
 * `onReturned` fires on the frame the interior is back.
 */
export function requestHeroReturn(onReturned, now = performance.now()) {
  if (!isExteriorActive()) return false
  if (state.phase !== HERO_STATE.RETURN) startExteriorMove(HERO_STATE.RETURN, HERO_T, now)
  state.onReturned = onReturned
  return true
}

/** Turns a `RETURN` back into the reveal from wherever it has got to. */
export function resumeHeroReveal(now = performance.now()) {
  state.onReturned = null
  state.leavingHero = false
  if (state.phase === HERO_STATE.RETURN) startExteriorMove(HERO_STATE.REVEAL, 1, now)
}

/**
 * True while the billboard should be taking its one capture.
 *
 * The hold is the ideal moment and the only correct one: the camera is frozen
 * on the canonical hero pose, so what the render target receives IS the final
 * interior frame — the exact image the billboard has to impersonate a frame
 * later. It is also invisible, because the billboard is still on a layer the
 * camera is not looking at.
 */
export function isHeroCaptureWindow() {
  return state.phase === HERO_STATE.HERO_HOLD
}

/**
 * Advances the machine one frame.
 *
 * `arrived` is the rig's report that its damped transform has converged on the
 * hero; the rig is the only thing that can know that, and the clock keys off
 * it so the pause is the same length however fast the viewer arrived.
 */
export function advanceHeroSequence(rawProgress, arrived, now = performance.now()) {
  switch (state.phase) {
    case HERO_STATE.TRAVEL: {
      // The clamp. Scroll may run past the hero; the CAMERA may not.
      state.progress = Math.min(rawProgress, HERO_T)
      // Far enough back that a fresh approach is clearly intended, so the beat
      // is available again on a genuine re-watch.
      if (rawProgress < HERO_T - REARM_BELOW) state.holdConsumed = false
      if (rawProgress < HERO_T) state.leavingHero = false
      if (rawProgress >= HERO_T && arrived && !state.leavingHero) {
        if (state.holdConsumed) {
          // Already seen it. Go straight on rather than stalling at the hero
          // with nothing to advance the sequence.
          startExteriorMove(HERO_STATE.REVEAL, 1, now)
        } else {
          state.phase = HERO_STATE.HERO_HOLD
          // Set exactly once, on the transition — never per frame, so repeated
          // renders cannot restart the clock.
          state.holdStartedAt = now
        }
      }
      break
    }

    case HERO_STATE.HERO_HOLD: {
      state.progress = HERO_T
      if (rawProgress < HERO_T - REVERSE_CANCEL_DRIFT) {
        // Deliberate reverse: abandon the beat and hand the camera back to
        // scroll. The pending reveal cannot fire later because it was never a
        // timer — it is a state, and the state has changed.
        state.phase = HERO_STATE.TRAVEL
        break
      }
      state.holdConsumed = true
      if (now - state.holdStartedAt >= HERO_HOLD_MS) startExteriorMove(HERO_STATE.REVEAL, 1, now)
      break
    }

    case HERO_STATE.REVEAL: {
      // Driven by its own clock, always from where the camera is, so however
      // much scroll piled up during the hold the pull-back begins at its
      // beginning.
      const move = exteriorMoveProgress(1, now)
      state.progress = move.progress
      // Scroll below the hero without a section jump (keyboard, scrollbar):
      // same rule as a requested return — the camera goes back to the hero
      // before the interior can show.
      if (rawProgress < HERO_T) {
        startExteriorMove(HERO_STATE.RETURN, HERO_T, now)
        break
      }
      if (move.t >= 1) state.phase = HERO_STATE.IMPACT
      break
    }

    case HERO_STATE.IMPACT: {
      // Settled. Scroll drives again so the viewer can travel back out.
      state.progress = Math.max(rawProgress, HERO_T)
      if (rawProgress < HERO_T) startExteriorMove(HERO_STATE.RETURN, HERO_T, now)
      break
    }

    case HERO_STATE.RETURN: {
      // An unrequested return gives way if scroll comes back up past the hero.
      if (!state.onReturned && rawProgress >= HERO_T) {
        startExteriorMove(HERO_STATE.REVEAL, 1, now)
        state.progress = exteriorMoveProgress(1, now).progress
        break
      }
      const move = exteriorMoveProgress(HERO_T, now)
      state.progress = move.progress
      // Hand over on ARRIVAL, exactly as the forward hold does, so the wall
      // replaces the billboard from the one pose where they match.
      if (move.t >= 1 && arrived) {
        state.phase = HERO_STATE.TRAVEL
        const onReturned = state.onReturned
        state.onReturned = null
        state.leavingHero = Boolean(onReturned)
        onReturned?.()
      }
      break
    }
  }

  renderedProgress.value = state.progress
  return state.progress
}

export const HERO_ARRIVAL_EPSILON = ARRIVAL_EPSILON
