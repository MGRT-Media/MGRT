import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  MODEL_URLS,
  cloneNode,
  measure,
  useDarkStateDimming,
  useModel,
  useTreatedMaterials,
} from '../models/modelAssets.js'
import { createScreenVideoMaterial } from '../digital/screenVideoMaterial.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { FILM_FOCUS_T, FILM_IGNITE_RISE } from '../timeline/filmActBeats.js'
import { BEAM_CENTER, YAW_DEGREES, CAMERA_STAND } from '../digital/plinthAnchor.js'

// How far before the true end of the clip playback seeks back to the start —
// browsers show a brief black frame at a real end-of-stream decode boundary,
// so playback never reaches one.
const LOOP_EARLY_SECONDS = 0.1

// Phase 2: the cinema-camera object explicitly deferred from Phase 1D
// (build-status.md §4's scope note). Stands on its own sleek 4-legged
// stand (quadrupod, below) rather than a stone plinth, per explicit
// request, positioned beside the Monitor's own plinth (`Monitor.jsx`) —
// both built around the same beam center/yaw (`plinthAnchor.js`). Tilted
// an additional `TILT_TOWARD_MONITOR_DEGREES` on top of that shared yaw
// so the lens turns toward the Monitor rather than staying parallel to it.
/**
 * How far the camera turns off the shared beam yaw, back at its original 32.
 *
 * This angle is NOT just the object's rotation. `CAMERA_ANCHOR.lensForward` is
 * built from it, and `cameraPath.js` derives the orbit alignment, the gate,
 * the approach and the lens dive from that vector — so changing it moves the
 * visitor's whole route through Act 1, not just which way the camera looks.
 *
 * That is why it is back at 32. Turning the camera further toward the Monitor
 * (the geometry says a true 90 would point straight at it) swung the entire
 * approach round with it, to the point where the wide shots looked at the
 * Monitor's back. The path is the thing that must not move, so this stays.
 *
 * Pointing the camera further at the Monitor therefore needs the object's own
 * yaw separated from the approach axis — see the note in the report. Until
 * they are separate values, these two goals are the same number pulling in
 * opposite directions.
 */
const TILT_TOWARD_MONITOR_DEGREES = 32

// Exported so FullscreenButton.jsx's modal CTA (§4BN) can play the same
// file directly, instead of hardcoding this path a second time.
export const FILM_MEDIA_SRC = '/media/film/film-01-hero.mp4'

const BODY = { width: 0.42, height: 0.28, depth: 0.5, cornerRadius: 0.035 }
const LENS = { frontRadius: 0.07, rearRadius: 0.09, length: 0.26 }
const VIEWFINDER = { width: 0.1, height: 0.08, depth: 0.12 }

// The camera rig arrives with its own tripod (see MODEL_STAND_NODE), so the
// procedural quadpod that used to stand in for it — its geometry, its leg
// transform solver and its own material — is gone with it. `CAMERA_STAND.standHeight`
// survives as the contract the model's tripod is fitted to.

// Derived from the constants above, never from the model. `CAMERA_ANCHOR`
// below is built on these, and `cameraPath.js`'s Act 1 lens-dive keyframe and
// `DepthOfField`'s focus target are both built on that — so swapping the asset
// must not move them.
const bodyCenterHeight = CAMERA_STAND.standHeight + BODY.height / 2

/**
 * Where this asset's front element actually is, once fitted.
 *
 * These are measured off the model after `useFittedCameraBody` has scaled and
 * placed it — not chosen, and not the same thing as the `BODY`/`LENS` box
 * above. That box described the procedural lens this replaced, which put its
 * front face at z = 0.51; the real glass sits at z = 0.088 and 6cm lower.
 *
 * That gap is what broke the Act 1 dive. `cameraPath.js` builds
 * `LENS_DIVE_POSITION` by walking `LENS_DIVE_DISTANCE` along the lens axis
 * from this anchor, and the anchor was roughly 0.42 units in front of the
 * camera — so the dive's endpoint landed past the object entirely and the beat
 * framed an empty room. The path was never wrong; it was aimed at a point that
 * no longer had a lens at it.
 *
 * Local to the object's own frame, so they compose with the shared beam yaw
 * and this object's tilt exactly as the old constants did.
 */
const LENS_FRONT_LOCAL = { x: -0.028, y: 0.7813, z: 0.0879 }

/**
 * The image plane sits at the MOUTH of the lens assembly, not at the glass.
 *
 * The glass is recessed 0.16 behind the rig's frontmost geometry. Framing the
 * dive on it meant the shot's endpoint was inside the hood: the body clipped
 * the picture, the composition went off-axis, and the room showed past the
 * edge of the housing. Bringing the image forward to the mouth means the dive
 * can stop clear of the camera and still look straight down the barrel, which
 * is what "looking into the lens" actually looks like.
 *
 * `z` stops short of the 0.25 front plane so the image reads as sitting inside
 * the barrel rather than pasted onto its face.
 */
const LENS_IMAGE_LOCAL = { x: LENS_FRONT_LOCAL.x, y: LENS_FRONT_LOCAL.y, z: LENS_FRONT_LOCAL.z + 0.002 }
const LENS_IMAGE_RADIUS = 0.0354


// World-space anchor, combining the shared beam yaw with this object's
// own plinth offset AND its extra tilt — all pure Y-axis rotations, so
// they compose by simple addition. Exported for `cameraPath.js`'s Act 1
// lens-dive keyframe to derive its framing from the object's real
// geometry rather than hand-picked numbers, the same role `MONITOR_ANCHOR`
// plays for the Digital handshake.
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const yawRadians = THREE.MathUtils.degToRad(YAW_DEGREES)
const tiltRadians = THREE.MathUtils.degToRad(TILT_TOWARD_MONITOR_DEGREES)
const totalYawRadians = yawRadians + tiltRadians

const localOffset = new THREE.Vector3(CAMERA_STAND.offsetX, 0, 0).applyAxisAngle(Y_AXIS, yawRadians)
const worldOrigin = localOffset.add(new THREE.Vector3(BEAM_CENTER[0], 0, BEAM_CENTER[2]))
const lensForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y_AXIS, totalYawRadians)

// The lens sits off the object's own centreline, so its lateral offset is
// carried through the same rotation as its forward one — otherwise the dive
// lines up with the camera's axis but not with its glass, and the shot ends
// up looking slightly past the lens rather than into it.
const lensLocalOffset = new THREE.Vector3(LENS_IMAGE_LOCAL.x, 0, LENS_IMAGE_LOCAL.z).applyAxisAngle(
  Y_AXIS,
  totalYawRadians,
)
const lensFrontFieldPosition = worldOrigin
  .clone()
  .add(lensLocalOffset)
  .setY(LENS_IMAGE_LOCAL.y)

export const CAMERA_ANCHOR = {
  bodyCenterHeight,
  // The IMAGE's radius, not the barrel's. `cameraPath.js` sizes the dive so
  // this radius fills the frame, and the thing that should fill the frame is
  // the film, not the metal around it.
  lensRadius: LENS_IMAGE_RADIUS,
  lensFrontFieldPosition: lensFrontFieldPosition.toArray(),
  lensForward: lensForward.toArray(),
}

/**
 * The camera body, from `film-camera.glb`.
 *
 * **Why the model's own lenses are hidden and this project's lens is
 * kept.** `cameraPath.js` turns `CAMERA_ANCHOR.lensRadius` into the Film
 * dive's stopping distance, so whatever sits at the anchor has to be that
 * radius or the dive stops at the wrong size. Fitting the model by its
 * taking lens does satisfy that — and was built and measured — but the
 * two objects have opposite proportions: this project's camera carries a
 * 0.07 lens on a 0.5 body (a ratio of 0.14), while the model carries a
 * 4.18 lens on a 120 body (0.035). Matching the lens therefore scales the
 * body up four-fold, to just over two metres, and the dive ends INSIDE
 * it — which is exactly what it did.
 *
 * So the model supplies the body, and the lens assembly the camera path
 * is derived from is left alone: barrel, dome and the video screen behind
 * it all keep their existing geometry and position. The dive frames the
 * same aperture at the same distance as before, and the Film clip still
 * plays where it always did.
 *
 * The body is fitted by matching its length along the optical axis to
 * `BODY.depth`. That is not arbitrary: at that scale the model's height
 * comes out at 0.295 against the box's own 0.28, so the two objects agree
 * on proportion as well as footprint, and the barrel still protrudes from
 * the front face the way it did.
 */
const MODEL_LENS_NODES = ['Lenses_Metal_0', 'Lenses_BlackPlastic_0', 'Lenses_Misc_0']
/**
 * `studio_objs.fbx`'s camera rig, converted to GLB (see build notes). The FBX
 * held a whole studio — 241 meshes, 96k triangles, lights and a sky dome — of
 * which only `film_camera` was wanted; it already carries its own `tripod`, so
 * the procedural quadpod this used to stand on is gone.
 *
 * Its own lens parts are stripped on import, and the procedural lens that used
 * to stand in front of them has since been removed too — the camera is the
 * body asset alone. `lensFrontZ` survives as pure geometry-free maths: it is
 * what `CAMERA_ANCHOR`, `cameraPath.js`'s Act 1 keyframe and `DepthOfField`'s
 * focus target are derived from, so it now marks a point in space rather than
 * an object.
 */
/**
 * `1930s_movie_camera.glb`, optimised (18MB / 216k tris as downloaded, down to
 * 784KB / 41k after simplification, texture reduction and meshopt).
 *
 * The asset arrives as loose parts rather than one group, so the rig is
 * gathered by prefix — `Lenses_` included. The lens here is the model's own,
 * not the procedural barrel-and-dome that used to be bolted to the front of a
 * different asset; that construction is still gone.
 *
 * `lensFrontZ` still exists in the maths above and still has no geometry
 * behind it: it is what `CAMERA_ANCHOR`, `cameraPath.js`'s Act 1 keyframe and
 * `DepthOfField`'s focus target derive from, so it marks a point in space.
 */
const MODEL_BODY_PREFIXES = /^(Camera|Eyepiece|Handle|Lenses)_/
const MODEL_STAND_NODE = 'tripod'

function useFittedCameraBody() {
  const gltf = useModel(MODEL_URLS.camera)

  return useMemo(() => {
    const group = new THREE.Group()
    const parts = []
    gltf.scene.traverse((o) => {
      if (o.isMesh && MODEL_BODY_PREFIXES.test(o.name)) parts.push(o)
    })
    if (!parts.length) return group

    const inner = new THREE.Group()
    parts.forEach((part) => {
      part.updateWorldMatrix(true, false)
      const clone = part.clone(true)
      clone.matrix.copy(part.matrixWorld)
      clone.matrix.decompose(clone.position, clone.quaternion, clone.scale)
      clone.matrixAutoUpdate = true
      inner.add(clone)
    })
    group.add(inner)

    /**
     * The yaw is measured from the model, not chosen.
     *
     * Two hand-picked values were wrong before this: -90 put the camera side
     * on, +90 put its back to the approach. Both were derived by rounding the
     * optical axis to the nearest cardinal direction, and this asset's axis is
     * not on one — it runs about 23 degrees off -X. Rounding it to -X and
     * yawing by a quarter turn leaves exactly that error in the result, which
     * is enough to turn a camera away from the shot built to fly into it.
     *
     * So the axis is taken from the geometry — eyepiece centroid to lens
     * centroid, the camera's real optical line — and the yaw needed to bring
     * it onto +Z is solved directly. Nothing to get wrong by eye, and it stays
     * correct if the asset is ever swapped again.
     */
    const centroidOf = (pattern) => {
      const box = new THREE.Box3()
      inner.traverse((o) => {
        if (o.isMesh && pattern.test(o.name)) box.expandByObject(o)
      })
      return box.isEmpty() ? null : box.getCenter(new THREE.Vector3())
    }
    const lensCentroid = centroidOf(/^Lenses_/)
    const eyeCentroid = centroidOf(/^Eyepiece_/)
    if (lensCentroid && eyeCentroid) {
      const axis = lensCentroid.clone().sub(eyeCentroid)
      // Angle of the optical axis from +Z in the ground plane; rotating by its
      // negative brings the axis onto +Z.
      group.rotation.y = -Math.atan2(axis.x, axis.z)
    }

    const authored = measure(inner)
    // Post-rotation the optical axis is Z, so that extent is the body's
    // length.
    inner.scale.setScalar(BODY.depth / authored.size.z)

    const scaled = measure(inner)
    group.position.x -= scaled.center.x
    group.position.y += bodyCenterHeight - scaled.center.y
    // Front face on the body's own front plane, so the barrel that follows
    // it emerges from the housing rather than floating clear of it.
    group.position.z += BODY.depth / 2 - scaled.box.max.z
    return group
  }, [gltf])
}

/**
 * The rig's own tripod, fitted to `CAMERA_STAND.standHeight`.
 *
 * That height is not cosmetic: `bodyCenterHeight` derives from it, and
 * `CAMERA_ANCHOR` — and therefore the Act 1 lens-dive keyframe and the depth
 * of field's focus target — derive from that. So the stand is scaled to the
 * height the rest of the system already expects rather than the height it was
 * modelled at, and the camera body stays exactly where it was.
 */
function useFittedTripod() {
  const gltf = useModel(MODEL_URLS.cameraStand)

  return useMemo(() => {
    const group = new THREE.Group()
    const stand = cloneNode(gltf, MODEL_STAND_NODE)
    if (!stand) return group

    const inner = new THREE.Group()
    inner.add(stand)
    group.add(inner)
    group.rotation.y = -Math.PI / 2

    const authored = measure(inner)
    inner.scale.setScalar(CAMERA_STAND.standHeight / authored.size.y)

    const scaled = measure(inner)
    group.position.x -= scaled.center.x
    group.position.z -= scaled.center.z
    // Feet on the floor, head at the height the body is already placed at.
    group.position.y -= scaled.box.min.y
    return group
  }, [gltf])
}

/** Dark, lightly metallic body — the finish the procedural camera had. */
function cameraBodyTreatment(material) {
  material.roughness = Math.max(material.roughness ?? 1, 0.45)
  material.metalness = Math.min(material.metalness ?? 0, 0.6)
  // 0.2 -> 0.9. The old 0.2 was set for the previous rig, whose materials were
  // near-white studio plastic and needed pulling down hard. This asset is
  // ALREADY dark metal and black plastic — its own albedo does that job — so
  // the two compounded and the camera collapsed into an unreadable mass: no
  // barrel, no rings, no magazine.
  //
  // Near 1 is the right answer here rather than a middle value, because the
  // camera stands outside the beam's pool and is lit almost entirely by the
  // hemisphere fill. There is very little light on it to begin with, so
  // darkening its albedo on top of that removes the object rather than
  // subduing it. It still reads well below the architecture; that is the
  // lighting doing the work, which is where it belongs.
  if (material.color) material.color.multiplyScalar(0.9)
}

/**
 * The stand, held well below the camera it carries.
 *
 * It shares the camera's model treatment in every respect except value: the
 * tripod's own albedo is bright metal, and at the body's multiplier it read as
 * the brightest object in the frame — a white armature with a dark camera
 * perched on it, which inverts what the shot is about. This is a support, and
 * supports recede.
 */
function cameraStandTreatment(material) {
  cameraBodyTreatment(material)
  if (material.color) material.color.multiplyScalar(0.18)
}

export default function CinemaCamera() {
  const cameraBody = useFittedCameraBody()
  const tripod = useFittedTripod()
  useTreatedMaterials(cameraBody, cameraBodyTreatment)
  useTreatedMaterials(tripod, cameraStandTreatment)
  // Dark-state only — see `useDarkStateDimming`. Lighter-handed than the
  // monitor's: this body is already the darkest object in the opening
  // frame, so it needs its specular highlights pulled back off the
  // architecture rather than the whole form pushed toward black.
  // 0.7 -> 0.85. The dark-state dimmer multiplies on top of the albedo above,
  // so at ignition 0 the two together were taking this object to ~14% of its
  // authored colour. Lighter-handed now that the base is no longer overcooked.
  useDarkStateDimming(cameraBody, 0.9)
  useDarkStateDimming(tripod, 0.9)

  // Act 1's film media, on the lens the model actually has. Same dormant/ignite
  // material the monitor uses; ignition is a smooth hill centred on
  // FILM_FOCUS_T, read from scrollProgress every frame so the same progress
  // always gives the same level regardless of scroll direction or speed.
  const video = useMemo(() => {
    const el = document.createElement('video')
    el.src = FILM_MEDIA_SRC
    el.loop = true
    el.muted = true
    el.playsInline = true
    // Nothing is fetched until the beat that needs it — see Monitor.jsx for
    // the same reasoning and the same tradeoff.
    el.preload = 'none'
    return el
  }, [])
  const videoTexture = useMemo(() => new THREE.VideoTexture(video), [video])
  const lensScreenMaterial = useMemo(
    // targetAspect 1: the aperture is round, so the image is cover-fitted into
    // a square and the disc crops it.
    () => createScreenVideoMaterial(videoTexture, 1, { lensEffect: true }),
    [videoTexture],
  )
  const wasPlaying = useRef(false)

  useEffect(() => {
    const onLoadedMetadata = () => {
      lensScreenMaterial.uniforms.uVideoAspect.value = video.videoWidth / video.videoHeight
    }
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    return () => video.removeEventListener('loadedmetadata', onLoadedMetadata)
  }, [video, lensScreenMaterial])

  useFrame(() => {
    const p = scrollProgress.value
    const rise = THREE.MathUtils.smoothstep(p, FILM_FOCUS_T - FILM_IGNITE_RISE, FILM_FOCUS_T)
    const fall = 1 - THREE.MathUtils.smoothstep(p, FILM_FOCUS_T, FILM_FOCUS_T + FILM_IGNITE_RISE)
    const ignite = Math.min(rise, fall)
    lensScreenMaterial.uniforms.uIgnite.value = ignite

    const shouldPlay = ignite > 0.02
    if (shouldPlay && !wasPlaying.current) {
      video.currentTime = 0
      video.play().catch(() => {})
    } else if (!shouldPlay && wasPlaying.current) {
      video.pause()
    }
    wasPlaying.current = shouldPlay

    // Seek back shortly before the true end: a real end-of-stream is a decode
    // boundary and browsers commonly show a black frame across it.
    if (shouldPlay && video.duration && video.currentTime >= video.duration - LOOP_EARLY_SECONDS) {
      video.currentTime = 0
    }
  })

  return (
    <group position={BEAM_CENTER} rotation={[0, yawRadians, 0]}>
      <group position={[CAMERA_STAND.offsetX, 0, 0]} rotation={[0, tiltRadians, 0]}>
        {/* The rig's own tripod, from the same asset as the body — see
            `useFittedTripod`. Replaces the procedural quadpod, which existed
            only because the previous camera model had no support of its own. */}
        <primitive object={tripod} />

        {/* Camera body (film-camera.glb), replacing the procedural
            body, viewfinder and lens barrel. Fitted to `CAMERA_ANCHOR` —
            see `useFittedCameraBody` for why that fit, rather than a
            chosen scale, is what keeps the Film lens-dive valid. The
            quadpod stand above is kept: the model has no support of its
            own, and the stand is what sets `CAMERA_STAND.standHeight`,
            which `bodyCenterHeight` (and so the camera path) derives
            from. */}
        <primitive object={cameraBody} />

        {/* Film image, on the model's own front element. Position and radius
            come from the same measured constants `CAMERA_ANCHOR` is built
            from, so what the dive frames and what is actually drawn cannot
            drift apart. */}
        <mesh
          position={[LENS_IMAGE_LOCAL.x, LENS_IMAGE_LOCAL.y, LENS_IMAGE_LOCAL.z]}
          castShadow={false}
          receiveShadow={false}
        >
          <circleGeometry args={[LENS_IMAGE_RADIUS, 48]} />
          <primitive object={lensScreenMaterial} attach="material" />
        </mesh>

        {/* The camera is the body asset alone, per explicit request:
            the procedural barrel, glass dome, lip and the film-media screen
            that sat behind them are all gone, and the model's own optics stay
            hidden as before.

            `LENS` and `lensFrontZ` above are deliberately KEPT even though
            nothing is drawn from them any more. They are what `CAMERA_ANCHOR`
            is built from, and `cameraPath.js`'s Act 1 keyframe and
            `DepthOfField`'s focus target are both built on that — so they now
            describe a point in space the camera still flies to, rather than a
            piece of geometry. Deleting them would move the camera path, which
            this change was explicitly not to touch. */}
      </group>
    </group>
  )
}
