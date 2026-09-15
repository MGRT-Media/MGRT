import * as THREE from 'three'
import { cameraProgress, renderedProgress } from './journeyProgress.js'

/**
 * The progress that scene CONTENT reflects — screens, videos, lights, overlays.
 *
 * Every content effect is a pure function of progress along the journey (the
 * lens lights up around Film, the monitor around Digital, the hero uplight
 * before the wall). That is exactly right while the camera travels the
 * journey. A section flight does not: it goes straight from one section to
 * another, and feeding it a sweep of progress values would light up every
 * section in between as the number passed through.
 *
 * So while a flight runs, content shows a blend of two states — where the
 * camera left and where it is going — weighted by the flight. Intermediate
 * progress values are never evaluated at all. Outside a flight it is simply
 * the live value, so the scroll journey behaves exactly as before.
 *
 * Two live bases, matching what content already keyed off:
 *  - `camera`: where the camera actually is along the path (`cameraProgress`);
 *  - `rendered`: what the journey is drawing (`renderedProgress`, clamped at the hero).
 */
const BASES = { camera: cameraProgress, rendered: renderedProgress }

/**
 * `null` while nothing is blending. Otherwise a node:
 *  - `{ values }`: a snapshot of both bases, the state a flight started from;
 *  - `{ from, to, weight }`: a blend from a node towards progress `to`;
 *  - `{ from, to: 'live', startedAt, durationMs }`: a timed hand back to the
 *    live bases, used when a flight is interrupted part-way.
 * A redirected flight nests the old blend, frozen, as its `from`, so content
 * carries on from wherever it had got to rather than jumping.
 */
let blend = null
const MAX_DEPTH = 4

function liveSnapshot() {
  return { values: { camera: cameraProgress.value, rendered: renderedProgress.value } }
}

function depth(node) {
  return node.values ? 0 : 1 + depth(node.from)
}

function weightOf(node, now) {
  if (node.to !== 'live') return node.weight
  return THREE.MathUtils.clamp((now - node.startedAt) / node.durationMs, 0, 1)
}

/** Starts blending content towards `targetProgress`, from whatever it shows now. */
export function beginContentBlend(targetProgress) {
  let from = blend ? blend : liveSnapshot()
  // A blend that had not started contributes nothing but its own source.
  if (from.weight === 0 && from.from) from = from.from
  if (depth(from) >= MAX_DEPTH) from = liveSnapshot()
  blend = { from, to: targetProgress, weight: 0 }
}

export function setContentBlendWeight(weight) {
  if (blend && blend.to !== 'live') blend.weight = THREE.MathUtils.clamp(weight, 0, 1)
}

/** The flight arrived: content is exactly the destination, which is now live. */
export function endContentBlend() {
  blend = null
}

/** The flight was interrupted: ease content back to the live bases over `seconds`. */
export function releaseContentBlend(seconds) {
  if (!blend) return
  blend = { from: blend, to: 'live', startedAt: performance.now(), durationMs: Math.max(seconds, 0.001) * 1000 }
}

function evaluate(node, fn, base, now) {
  if (node.values) return fn(node.values[base])
  const weight = weightOf(node, now)
  const toValue = fn(node.to === 'live' ? BASES[base].value : node.to)
  if (weight >= 1) return toValue
  return THREE.MathUtils.lerp(evaluate(node.from, fn, base, now), toValue, weight)
}

function evaluateCondition(node, predicate, base, now) {
  if (node.values) return predicate(node.values[base])
  const weight = weightOf(node, now)
  const toHolds = weight > 0 && predicate(node.to === 'live' ? BASES[base].value : node.to)
  return toHolds || (weight < 1 && evaluateCondition(node.from, predicate, base, now))
}

/** `fn(progress)` for content, blended across a section flight. */
export function contentValue(fn, base = 'camera') {
  if (!blend) return fn(BASES[base].value)
  const now = performance.now()
  if (blend.to === 'live' && weightOf(blend, now) >= 1) {
    blend = null
    return fn(BASES[base].value)
  }
  return evaluate(blend, fn, base, now)
}

/**
 * `predicate(progress)` for content that switches rather than fades — a video
 * that should be playing. During a flight it holds for the state being left
 * until that is fully faded out, and for the destination as soon as it starts
 * fading in, so a video is ready by the time it is visible.
 */
export function contentCondition(predicate, base = 'camera') {
  if (!blend) return predicate(BASES[base].value)
  return evaluateCondition(blend, predicate, base, performance.now())
}
