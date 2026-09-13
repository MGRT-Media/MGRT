import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { scrollProgress, scrollLockWobble } from './ScrollTimelineProvider.jsx'
import { sampleCameraPath, sampleCameraPathInto, setHeroAspect } from './cameraPath.js'
import { HERO_ARRIVAL_EPSILON, advanceHeroSequence, cameraProgress, isHeroFrozen } from './heroSequence.js'
import { HERO_T } from './filmActBeats.js'

// Lowered from 3.5 (both were previously equal) per explicit request to
// give the camera more perceived "weight and inertia" as it settles, and
// to stop position/rotation from converging in perfect lockstep. Position
// is intentionally the heavier (slower/lower) of the two, so the camera
// keeps gliding to its resting spot for a beat after it's already
// finished turning to face it, rather than both stopping on the same
// frame.
const POSITION_DAMP_LAMBDA = 2.6
const ROTATION_DAMP_LAMBDA = 3.0

// How quickly an attempted-scroll wobble (ScrollTimelineProvider.jsx's
// Snap 2 hard lock, "Subtle Resistance Fallback") decays back toward 0
// once the visitor stops pushing against it — a spring release, not an
// instant snap-back.
const WOBBLE_DECAY_LAMBDA = 6

// Reused across frames rather than allocated fresh each tick — pure
// scratch space, never read from outside this module.
const scratchMatrix = new THREE.Matrix4()
const targetQuaternionScratch = new THREE.Quaternion()
const forwardScratch = new THREE.Vector3()
// Written by `sampleCameraPathInto` every frame — see its note on why the
// per-frame path does not use the allocating sampler.
const pathPositionScratch = new THREE.Vector3()
const pathLookAtScratch = new THREE.Vector3()
const heroPoseScratch = new THREE.Vector3()
const HERO_SAMPLE_SCRATCH = { value: 0 }
const arcSampleScratch = new THREE.Vector3()
const arcPreviousScratch = new THREE.Vector3()
const arcLookAtScratch = new THREE.Vector3()

/**
 * Distance along the camera path, tabulated against progress.
 *
 * Position is eased in this space — see the frame loop. Rebuilt whenever the
 * hero stand-off changes with the viewport, since that moves the keyframes the
 * table was measured from. Linear between samples; the camera itself is always
 * placed with `sampleCameraPathInto`, so the table only paces the move and
 * never bends it.
 */
const ARC_SAMPLES = 2048
const arcLengths = new Float32Array(ARC_SAMPLES + 1)

function rebuildArcLengths() {
  sampleCameraPathInto(0, arcPreviousScratch, arcLookAtScratch)
  let total = 0
  arcLengths[0] = 0
  for (let i = 1; i <= ARC_SAMPLES; i += 1) {
    sampleCameraPathInto(i / ARC_SAMPLES, arcSampleScratch, arcLookAtScratch)
    total += arcSampleScratch.distanceTo(arcPreviousScratch)
    arcPreviousScratch.copy(arcSampleScratch)
    arcLengths[i] = total
  }
}

function arcLengthAt(progress) {
  const x = THREE.MathUtils.clamp(progress, 0, 1) * ARC_SAMPLES
  const i = Math.min(Math.floor(x), ARC_SAMPLES - 1)
  return THREE.MathUtils.lerp(arcLengths[i], arcLengths[i + 1], x - i)
}

function progressAtArcLength(length) {
  if (length <= 0) return 0
  if (length >= arcLengths[ARC_SAMPLES]) return 1
  let lo = 0
  let hi = ARC_SAMPLES
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (arcLengths[mid] <= length) lo = mid
    else hi = mid
  }
  const span = arcLengths[hi] - arcLengths[lo]
  return (lo + (span > 0 ? (length - arcLengths[lo]) / span : 0)) / ARC_SAMPLES
}

function computeTargetQuaternion(outQuaternion, eye, lookAtPoint, up) {
  scratchMatrix.lookAt(eye, lookAtPoint, up)
  return outQuaternion.setFromRotationMatrix(scratchMatrix)
}

/**
 * Drives the camera from the scroll-derived target every frame, but never
 * snaps directly to it. Position: `THREE.MathUtils.damp` (frame-rate
 * independent exponential) on distance along the path, so the camera stays
 * on the authored route — see the note in the frame loop. Rotation: no longer a
 * damped lookAt *point* fed through `camera.lookAt()` every frame — per
 * explicit request that turning to face the lens "felt robotically
 * hinged... like a sharp pivot on a rigid axis" rather than a fluid arc.
 * Damping a 3D point and re-deriving a lookAt matrix from it each frame
 * doesn't interpolate *rotation* at a constant rate; for a large turn
 * (e.g. dolly-in while also swinging from the establish framing to the
 * lens) the apparent angular speed can vary in a way that reads as
 * hinged rather than swept. Real spherical interpolation needs to happen
 * in rotation-space, so this now derives a target orientation
 * (`computeTargetQuaternion`, a look-at matrix converted to a quaternion)
 * and `Quaternion.slerp`s the camera's actual orientation toward it every
 * frame — genuine constant-angular-velocity rotation, independent of how
 * far the lookAt point itself is from the camera. Still a direct
 * `camera.position`/`camera.quaternion` mutation inside `useFrame` —
 * never a React state update — per technical-architecture.md §7.
 */
export default function ScrollCameraRig() {
  // Seeded to the progress-0 keyframe so there's no startup glide-in from
  // an arbitrary default on mount — reads `sampleCameraPath(0)` directly
  // rather than a copied literal, matching `CinematicExperience.jsx`'s own
  // `SEED_POSITION` (its `<Canvas camera position={...}>` prop). A prior
  // round's hardcoded `(-1.0, 1.6, 8)` fell out of sync with the real
  // progress-0 position after several later rounds changed the exterior
  // orbit's radius/height/room scale (§4BE, §4BK) without this literal
  // being updated — exactly the "visible jump/readjustment on load" bug
  // this was meant to prevent: on mount, the Canvas's own seed placed the
  // camera correctly, but this rig's *separate* `dampedPosition` ref still
  // started from the stale value, so the very first frames visibly damped
  // FROM the wrong position TO the correct one. Importing the function
  // instead of a copied number makes this class of drift impossible again.
  const dampedPosition = useRef(new THREE.Vector3(...sampleCameraPath(0).position))
  const dampedQuaternion = useRef(
    computeTargetQuaternion(
      new THREE.Quaternion(),
      dampedPosition.current,
      new THREE.Vector3(...sampleCameraPath(0).lookAt),
      new THREE.Vector3(0, 1, 0),
    ),
  )

  const heroAspect = useRef(0)
  // How far along the path the camera is — the eased quantity. See below.
  const arcPosition = useRef(0)

  useFrame(({ camera }, delta) => {
    // The MGRT hero frames the wordmark by WIDTH, so its stand-off depends on
    // the viewport's aspect — see `heroDistanceForAspect`. Recomputed only when
    // the aspect actually changes rather than every frame, since it walks the
    // wall's plan curve.
    if (camera.aspect !== heroAspect.current) {
      const progressBefore = heroAspect.current === 0 ? 0 : progressAtArcLength(arcPosition.current)
      heroAspect.current = camera.aspect
      setHeroAspect(camera.aspect)
      rebuildArcLengths()
      arcPosition.current = arcLengthAt(progressBefore)
      // The canonical hero pose for this viewport, cached so arrival can be
      // measured every frame without re-walking the path.
      heroPoseScratch.fromArray(sampleCameraPath(HERO_T).position)
    }

    // Sample the hero pose once per frame so arrival can be measured against
    // it, then let the machine choose the progress actually rendered.
    const arrived = dampedPosition.current.distanceTo(heroPoseScratch) < HERO_ARRIVAL_EPSILON
    HERO_SAMPLE_SCRATCH.value = advanceHeroSequence(scrollProgress.value, arrived, performance.now())

    /**
     * The sequence decides what to draw — not raw scroll. See
     * `heroSequence.js`: while travelling it clamps at the hero, during the
     * hold it pins there, and the reveal runs on its own clock.
     *
     * Arrival is reported from here because this is the only place that knows
     * where the damped camera actually is; the machine cannot see it.
     */
    sampleCameraPathInto(HERO_SAMPLE_SCRATCH.value, pathPositionScratch, pathLookAtScratch)

    // Position is damped in DISTANCE ALONG THE PATH, then placed on the path.
    //
    // It used to be damped per axis toward the sampled point, which always
    // takes the straight line to the target. A section jump runs that target
    // metres ahead of the camera, so wherever the route bends the camera cut
    // the chord instead. The Digital <-> hero traversal bends hardest right at
    // the monitor — it backs away from the screen and swings round before
    // heading down the room — and in reverse that chord ran over the computer
    // from behind: the room gave way to the screen filling the frame with the
    // physical monitor never coming into shot. Damping the distance keeps
    // every frame ON the authored route in either direction, and a reversal
    // turns round from wherever the camera actually is.
    //
    // Distance rather than raw progress because it keeps the old pacing:
    // per-axis damping moved at `lambda x distance-to-target`, and so does
    // this. Progress is compressed unevenly along the route (the hero glide is
    // eased inside the sampler), and damping it bunched the speed into the
    // middle of the room at more than twice the old peak.
    const pos = dampedPosition.current
    const targetArc = arcLengthAt(HERO_SAMPLE_SCRATCH.value)
    if (isHeroFrozen()) {
      // Written verbatim, not damped. Damping only ever ASYMPTOTES toward its
      // target, so a damped hold still creeps by a hair every frame — enough
      // to read as drift over a second and a half. Copying the pose outright
      // is what makes the frame bit-identical for the whole hold.
      arcPosition.current = targetArc
      pos.copy(pathPositionScratch)
      cameraProgress.value = HERO_SAMPLE_SCRATCH.value
    } else {
      arcPosition.current = THREE.MathUtils.damp(arcPosition.current, targetArc, POSITION_DAMP_LAMBDA, delta)
      // Settled: use the target itself, so a stretch of path where only the
      // aim changes cannot leave the camera parked at the wrong end of it.
      const settled = Math.abs(targetArc - arcPosition.current) < 1e-4
      cameraProgress.value = settled ? HERO_SAMPLE_SCRATCH.value : progressAtArcLength(arcPosition.current)
      sampleCameraPathInto(cameraProgress.value, pos, arcLookAtScratch)
    }

    // Orientation is derived from the path's OWN eye/target pair, not from
    // the damped eye — a real bug fix, not a refactor. Feeding the damped
    // `pos` here mixed position lag into the aim: the aim vector became
    // `(target - pos) = (targetLookAt - targetPosition) + (targetPosition -
    // pos)`, and that second term is the lag, which points along the
    // direction of travel and grows with speed. Any keyframe span whose
    // travel direction isn't parallel to its view direction therefore made
    // the camera YAW while moving and un-yaw as it settled — a
    // speed-proportional turn that no amount of keyframe tuning could
    // remove, and that `sampleCameraPath`'s own output can't reveal because
    // it only exists at runtime. Act 3 depends on this: its whole design is
    // a constant `lookAt - position` offset (see `cameraPath.js`'s
    // `CAMPAIGNS_FACING`), which is exactly the quantity this line was
    // corrupting. Rotation is still slerped toward the target, so the
    // damping feel is unchanged; only what it aims at is now lag-free.
    const targetQuaternion = computeTargetQuaternion(
      targetQuaternionScratch,
      pathPositionScratch,
      pathLookAtScratch,
      camera.up,
    )
    // Frame-rate-independent slerp factor with the same exponential shape
    // as THREE.MathUtils.damp, so rotation and position share one
    // consistent "catch-up" feel despite using different lambdas/math.
    const rotationAlpha = isHeroFrozen() ? 1 : 1 - Math.exp(-ROTATION_DAMP_LAMBDA * delta)
    dampedQuaternion.current.slerp(targetQuaternion, rotationAlpha)
    camera.quaternion.copy(dampedQuaternion.current)

    // Resistance wobble: decays toward 0 every frame regardless of
    // whether the lock is still active, so a released lock's residual
    // push finishes springing back rather than freezing mid-wobble.
    // Applied as a tiny pull backward along the camera's own (now
    // slerped) current view direction — purely cosmetic, decoupled from
    // the actual lock/camera-path state.
    scrollLockWobble.value = THREE.MathUtils.damp(scrollLockWobble.value, 0, WOBBLE_DECAY_LAMBDA, delta)
    if (scrollLockWobble.value !== 0) {
      const forward = forwardScratch.set(0, 0, -1).applyQuaternion(camera.quaternion)
      camera.position.copy(pos).addScaledVector(forward, -scrollLockWobble.value)
    } else {
      camera.position.copy(pos)
    }
  })

  return null
}
