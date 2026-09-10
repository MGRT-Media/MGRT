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
 */

export const HERO_STATE = {
  TRAVEL: 'TRAVEL',
  HERO_HOLD: 'HERO_HOLD',
  REVEAL: 'REVEAL',
  IMPACT: 'IMPACT',
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

const state = {
  phase: HERO_STATE.TRAVEL,
  holdStartedAt: 0,
  revealStartedAt: 0,
  /** What the rig should sample the path at this frame. */
  progress: 0,
}

/** Effective progress — what the camera is actually drawn from. */
export const renderedProgress = { value: 0 }

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
  return state.phase === HERO_STATE.REVEAL || state.phase === HERO_STATE.IMPACT
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
      if (rawProgress >= HERO_T && arrived) {
        state.phase = HERO_STATE.HERO_HOLD
        // Set exactly once, on the transition — never per frame, so repeated
        // renders cannot restart the clock.
        state.holdStartedAt = now
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
      if (now - state.holdStartedAt >= HERO_HOLD_MS) {
        state.phase = HERO_STATE.REVEAL
        state.revealStartedAt = now
      }
      break
    }

    case HERO_STATE.REVEAL: {
      // Driven by its own clock, always from HERO_T, so however much scroll
      // piled up during the hold the pull-back begins at its beginning.
      const t = THREE.MathUtils.clamp((now - state.revealStartedAt) / (HERO_REVEAL_SECONDS * 1000), 0, 1)
      const eased = t * t * (3 - 2 * t)
      state.progress = THREE.MathUtils.lerp(HERO_T, 1, eased)
      if (rawProgress < HERO_T - REVERSE_CANCEL_DRIFT) {
        state.phase = HERO_STATE.TRAVEL
        break
      }
      if (t >= 1) state.phase = HERO_STATE.IMPACT
      break
    }

    case HERO_STATE.IMPACT: {
      // Settled. Scroll drives again so the viewer can travel back out, and
      // dropping below the hero re-arms the whole sequence for a rewatch.
      state.progress = Math.max(rawProgress, HERO_T)
      if (rawProgress < HERO_T - REVERSE_CANCEL_DRIFT) state.phase = HERO_STATE.TRAVEL
      break
    }
  }

  renderedProgress.value = state.progress
  return state.progress
}

export const HERO_ARRIVAL_EPSILON = ARRIVAL_EPSILON
