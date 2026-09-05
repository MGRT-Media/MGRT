import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createScreenVideoMaterial } from '../digital/screenVideoMaterial.js'
import { MODEL_URLS, cloneNode, measure, useModel, useTreatedMaterials } from '../models/modelAssets.js'
import { scrollProgress } from '../timeline/ScrollTimelineProvider.jsx'
import { FILM_FOCUS_T, FILM_IGNITE_RISE } from '../timeline/filmActBeats.js'
import { BEAM_CENTER, YAW_DEGREES, CAMERA_STAND } from '../digital/plinthAnchor.js'

// Phase 2: the cinema-camera object explicitly deferred from Phase 1D
// (build-status.md §4's scope note). Stands on its own sleek 4-legged
// stand (quadrupod, below) rather than a stone plinth, per explicit
// request, positioned beside the Monitor's own plinth (`Monitor.jsx`) —
// both built around the same beam center/yaw (`plinthAnchor.js`). Tilted
// an additional `TILT_TOWARD_MONITOR_DEGREES` on top of that shared yaw
// so the lens turns toward the Monitor rather than staying parallel to it.
const TILT_TOWARD_MONITOR_DEGREES = 32

// Exported so FullscreenButton.jsx's modal CTA (§4BN) can play the same
// file directly, instead of hardcoding this path a second time.
export const FILM_MEDIA_SRC = '/media/film/film-01-hero.mp4'

// How far before the true end of the clip playback seeks back to the
// start — see the seamless-loop comment in the useFrame below for why.
const LOOP_EARLY_SECONDS = 0.1

const BODY = { width: 0.42, height: 0.28, depth: 0.5, cornerRadius: 0.035 }
const LENS = { frontRadius: 0.07, rearRadius: 0.09, length: 0.26 }
const VIEWFINDER = { width: 0.1, height: 0.08, depth: 0.12 }

// A sleek 4-legged pod, not a stone plinth — legs run straight from the
// floor to a small top hub, splayed outward at `spreadRadius`. All four
// legs are geometrically identical by symmetry (same length, same angle
// from vertical), so a single shared geometry is reused across all four
// mesh instances below, just at different positions/rotations.
const QUADPOD = {
  hubRadius: 0.1,
  hubHeight: 0.03,
  legRadius: 0.016,
  legFootRadius: 0.026,
  spreadRadius: 0.24,
}

const bodyCenterHeight = CAMERA_STAND.standHeight + BODY.height / 2
const lensCenterZ = BODY.depth / 2 + LENS.length / 2
const lensFrontZ = BODY.depth / 2 + LENS.length

/**
 * One leg's position (its midpoint) and rotation (aligning the default
 * Y-axis cylinder with the actual foot->hub direction), computed once via
 * a quaternion rather than the small hand-tuned lean angles used in this
 * object's very first tripod draft — exact regardless of how
 * `spreadRadius`/`standHeight` are tuned later.
 */
function computeLegTransform(footX, footZ, hubTopY) {
  const foot = new THREE.Vector3(footX, 0, footZ)
  const hubEdge = new THREE.Vector3(0, hubTopY, 0)
  const direction = new THREE.Vector3().subVectors(hubEdge, foot)
  const length = direction.length()
  const midpoint = new THREE.Vector3().addVectors(foot, hubEdge).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  const euler = new THREE.Euler().setFromQuaternion(quaternion)
  return { position: midpoint.toArray(), rotation: [euler.x, euler.y, euler.z] }
}

const QUADPOD_HUB_TOP_Y = CAMERA_STAND.standHeight - QUADPOD.hubHeight / 2
const QUADPOD_LEG_LENGTH = Math.hypot(QUADPOD.spreadRadius, QUADPOD_HUB_TOP_Y)
const QUADPOD_LEGS = [45, 135, 225, 315].map((deg) => {
  const rad = THREE.MathUtils.degToRad(deg)
  const footX = Math.sin(rad) * QUADPOD.spreadRadius
  const footZ = Math.cos(rad) * QUADPOD.spreadRadius
  return computeLegTransform(footX, footZ, QUADPOD_HUB_TOP_Y)
})

// The glass element's convex bulge, and the exact radius of a sphere that
// would produce it (sagitta formula: R = (bulge² + radius²) / (2*bulge)),
// used below both to build the dome profile and to size the barrel lip.
const GLASS_RADIUS = LENS.frontRadius * 0.92
const GLASS_BULGE = GLASS_RADIUS * 0.32
const GLASS_SPHERE_RADIUS = (GLASS_BULGE ** 2 + GLASS_RADIUS ** 2) / (2 * GLASS_BULGE)

/**
 * A smooth, convex optical lens element — a genuine spherical-cap dome,
 * not a flat disc — built as a `LatheGeometry` profile (matching this
 * codebase's existing convention for revolved forms, e.g. `Environment.jsx`
 * `useColumnGeometry`). `LatheGeometry` revolves around its local Y axis
 * by default; rather than bake a rotation into the geometry itself, the
 * mesh gets the same `rotation={[Math.PI / 2, 0, 0]}` already used on the
 * lens barrel cylinder below, so the profile's height parameter (0 at the
 * rim, `GLASS_BULGE` at the tip) becomes the final Z depth directly.
 */
function buildLensGlassGeometry() {
  // Raised from 12 — per explicit request that the lens read as
  // genuinely curved glass rather than a faceted 3D primitive, and the
  // lens-dive keyframe (cameraPath.js) brings this dome close enough to
  // fill nearly the whole frame, where coarser profile resolution would
  // be the first thing to show as flat-sided rather than smoothly round.
  const segments = 24
  const points = []
  for (let i = 0; i <= segments; i += 1) {
    const h = (i / segments) * GLASS_BULGE
    const distFromCenter = h + (GLASS_SPHERE_RADIUS - GLASS_BULGE)
    const radius = Math.sqrt(Math.max(GLASS_SPHERE_RADIUS ** 2 - distFromCenter ** 2, 0))
    points.push(new THREE.Vector2(radius, h))
  }
  const geometry = new THREE.LatheGeometry(points, 32)
  geometry.computeVertexNormals()
  return geometry
}

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
const bodyWorldOrigin = worldOrigin.clone().setY(bodyCenterHeight)
const lensFrontFieldPosition = bodyWorldOrigin.clone().addScaledVector(lensForward, lensFrontZ)

export const CAMERA_ANCHOR = {
  bodyCenterHeight,
  lensRadius: LENS.frontRadius,
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
const MODEL_BODY_NODES = [
  'Camera_Metal_0',
  'Camera_BlackPlastic_0',
  'Camera_Misc_0',
  'Eyepiece_BlackPlastic_0',
  'Eyepiece_Metal_0',
  'Eyepiece_Misc_0',
  'Handle_Metal_0',
  'Handle_BlackPlastic_0',
  'Handle_Misc_0',
]

function useFittedCameraBody() {
  const gltf = useModel(MODEL_URLS.camera)

  return useMemo(() => {
    const group = new THREE.Group()
    const parts = MODEL_BODY_NODES.map((name) => cloneNode(gltf, name)).filter(Boolean)
    if (!parts.length) return group

    const inner = new THREE.Group()
    inner.add(...parts)
    group.add(inner)

    // Authored looking down -X; +90 degrees about Y puts that on +Z, this
    // scene's forward.
    group.rotation.y = Math.PI / 2

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

/** Dark, lightly metallic body — the finish the procedural camera had. */
function cameraBodyTreatment(material) {
  material.roughness = Math.max(material.roughness ?? 1, 0.45)
  material.metalness = Math.min(material.metalness ?? 0, 0.6)
  if (material.color) material.color.multiplyScalar(0.4)
}

export default function CinemaCamera() {
  const cameraBody = useFittedCameraBody()
  useTreatedMaterials(cameraBody, cameraBodyTreatment)

  const hubGeometry = useMemo(
    () => new THREE.CylinderGeometry(QUADPOD.hubRadius, QUADPOD.hubRadius, QUADPOD.hubHeight, 20),
    [],
  )
  const legGeometry = useMemo(
    () => new THREE.CylinderGeometry(QUADPOD.legRadius, QUADPOD.legFootRadius, QUADPOD_LEG_LENGTH, 10),
    [],
  )
  const bodyGeometry = useMemo(
    () => new RoundedBoxGeometry(BODY.width, BODY.height, BODY.depth, 3, BODY.cornerRadius),
    [],
  )
  const viewfinderGeometry = useMemo(
    () => new RoundedBoxGeometry(VIEWFINDER.width, VIEWFINDER.height, VIEWFINDER.depth, 2, 0.015),
    [],
  )
  const lensGeometry = useMemo(
    // openEnded: true — a hollow tube, not a solid capped cylinder. Capped
    // (the default) would give the barrel its own opaque front face,
    // hiding the film-media screen mesh sitting just behind it.
    () => new THREE.CylinderGeometry(LENS.frontRadius, LENS.rearRadius, LENS.length, 20, 1, true),
    [],
  )
  const lensGlassGeometry = useMemo(() => buildLensGlassGeometry(), [])
  // A slim torus at the barrel's front opening — the "curved lip" that
  // frames the glass/video, per explicit request. An open-ended cylinder
  // alone has no edge thickness of its own to read as a lip. Tube
  // segments raised 12 -> 24 alongside the glass dome's own profile
  // resolution above, for the same reason: this rim sits right at the
  // frame's edge during the lens-dive close-up, where a coarser tube
  // cross-section would be the first thing to read as faceted rather
  // than a smoothly rounded edge.
  const lensLipGeometry = useMemo(
    () => new THREE.TorusGeometry(LENS.frontRadius, LENS.frontRadius * 0.09, 24, 32),
    [],
  )
  // Lens screen — Act 1's Film media (film-01-hero.mp4), sharing the same
  // dormant/ignite unlit material as the monitor screen. Ignition is a
  // smooth "hill" centered on FILM_FOCUS_T, a pure function of
  // scrollProgress read continuously in this object's own useFrame —
  // matching how VolumetricLightingRig and Monitor.jsx both derive their
  // own ignition directly from scrollProgress rather than an event, so
  // the same progress value always produces the same ignite level
  // regardless of scroll direction or speed.
  const video = useMemo(() => {
    const el = document.createElement('video')
    el.src = FILM_MEDIA_SRC
    el.loop = true
    el.muted = true
    el.playsInline = true
    el.preload = 'auto'
    return el
  }, [])
  const videoTexture = useMemo(() => new THREE.VideoTexture(video), [video])
  // targetAspect: 1 — the lens aperture reads as roughly circular/square,
  // unlike the video's native ~16:9. The material's cover-fit UV remap
  // (screenVideoMaterial.js) crops instead of stretching, eliminating the
  // dead space/letterboxing a plain 0-1 UV mapping left inside the lens.
  // lensEffect: true — adds the subtle barrel distortion + soft vignette
  // that same module now supports, per explicit request that this
  // specific preview "feel like a real cinema camera lens... not a hard
  // geometric shape" (Monitor.jsx's own screen leaves this off, since a
  // flat rectangular monitor shouldn't warp or vignette like glass).
  const lensScreenMaterial = useMemo(
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

    // Seamless loop: per explicit report of a black flash on the native
    // `loop` restart — browsers commonly show a brief empty/black frame
    // right at end-of-stream while the decoder resets for the jump back
    // to the start, since that reset is a real decode boundary, not
    // just a UI transition. Checked every rendered frame (far finer-
    // grained than the browser's own throttled `timeupdate` event, which
    // can fire as infrequently as ~4x/second — too coarse to reliably
    // land inside a sub-200ms window), so the seek back to `0` happens
    // shortly BEFORE the true end, and playback never actually reaches
    // end-of-stream in the first place. Seeking to `0` itself is cheap
    // and clean (encoders start files on a keyframe, so there's no
    // forward-decode needed), unlike the wrap-around the native `loop`
    // attribute performs. `el.loop = true` is left in place as a harmless
    // fallback in case this early seek is ever missed on a slow frame.
    if (shouldPlay && video.duration && video.currentTime >= video.duration - LOOP_EARLY_SECONDS) {
      video.currentTime = 0
    }
  })

  // Body/stand: dark, moderately metallic — a rubberized-metal cinema
  // camera finish, distinct from the monitor's matte painted casing
  // (Monitor.jsx's casingProps, metalness: 0.12) so the two objects read
  // as different material families rather than palette-matched twins.
  const bodyProps = { color: '#1c1c1e', roughness: 0.55, metalness: 0.4 }
  const standProps = { color: '#161616', roughness: 0.6, metalness: 0.5 }

  return (
    <group position={BEAM_CENTER} rotation={[0, yawRadians, 0]}>
      <group position={[CAMERA_STAND.offsetX, 0, 0]} rotation={[0, tiltRadians, 0]}>
        {/* Sleek 4-legged quadrupod — replaces the stone plinth, per explicit request */}
        {QUADPOD_LEGS.map((leg, i) => (
          <mesh
            key={i}
            position={leg.position}
            rotation={leg.rotation}
            geometry={legGeometry}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...standProps} />
          </mesh>
        ))}
        <mesh position={[0, QUADPOD_HUB_TOP_Y, 0]} geometry={hubGeometry} castShadow receiveShadow>
          <meshStandardMaterial {...standProps} />
        </mesh>

        {/* Camera body (film-camera.glb), replacing the procedural
            body, viewfinder and lens barrel. Fitted to `CAMERA_ANCHOR` —
            see `useFittedCameraBody` for why that fit, rather than a
            chosen scale, is what keeps the Film lens-dive valid. The
            quadpod stand above is kept: the model has no support of its
            own, and the stand is what sets `CAMERA_STAND.standHeight`,
            which `bodyCenterHeight` (and so the camera path) derives
            from. */}
        <primitive object={cameraBody} />

        {/* Lens barrel — tapers slightly toward the front element */}
        <mesh
          position={[0, bodyCenterHeight, lensCenterZ]}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={lensGeometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#0e0e0f" roughness={0.45} metalness={0.6} />
        </mesh>

        {/*
          Front glass element — a genuine convex dome (buildLensGlassGeometry),
          not a flat pane, for a real optical-lens read. `clearcoat` adds a
          second, sharper specular layer on top of the base reflection —
          the "anti-reflective coating" look real lens elements have — and
          low roughness + the dome's curvature together give the rim its
          own brightening at grazing angles (a "subtle rim highlight")
          without needing a dedicated fresnel shader. `transmission` still
          lets the video screen behind it read through with a soft depth,
          per explicit request for "subtle refractions."
        */}
        <mesh
          position={[0, bodyCenterHeight, lensFrontZ + 0.002]}
          geometry={lensGlassGeometry}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow={false}
          receiveShadow={false}
        >
          <meshPhysicalMaterial
            color="#050506"
            roughness={0.04}
            metalness={0}
            transmission={0.85}
            thickness={0.02}
            ior={1.5}
            clearcoat={1}
            clearcoatRoughness={0.05}
            transparent
            opacity={0.22}
          />
        </mesh>

        {/* Barrel lip — the curved rim framing the glass, per explicit request */}
        <mesh
          position={[0, bodyCenterHeight, lensFrontZ]}
          geometry={lensLipGeometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#0a0a0b" roughness={0.35} metalness={0.7} />
        </mesh>

        {/*
          Film-media screen, just behind the glass — ignites around the Act 1
          lens-dive beat. Previously sat 0.02 units back inside the tapered
          barrel at 0.94x the FRONT opening's radius — that fraction was
          only ever measured against the opening at z: lensFrontZ, but the
          screen itself sat recessed where the (tapered, frontRadius ->
          rearRadius) barrel tube is measurably wider, leaving a real,
          visible ring gap between the video's edge and the lip's inner
          edge, per explicit follow-up report. Fixed by moving the screen
          flush to the same z the lip itself sits at (a hair behind it,
          `- 0.001`, purely to avoid z-fighting with the lip's own
          geometry) and sizing it to `GLASS_RADIUS` — the exact radius the
          glass dome in front of it already uses, which was itself derived
          to nestle just inside the lip's inner edge (`buildLensGlassGeometry`'s
          own comment) — so the video now touches the same boundary the
          glass already touches, with no gap and no separate constant to
          keep in sync.
        */}
        <mesh position={[0, bodyCenterHeight, lensFrontZ - 0.001]} castShadow={false} receiveShadow={false}>
          <circleGeometry args={[GLASS_RADIUS, 32]} />
          <primitive object={lensScreenMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  )
}
