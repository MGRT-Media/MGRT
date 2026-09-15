import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HERO_LOOKAT, HERO_T, heroDistanceForAspect, heroPositionAt } from '../timeline/cameraPath.js'
import { isHeroCaptureWindow, markHeroCaptured } from '../timeline/heroSequence.js'
import { useExteriorLayer } from './layers.js'
import { MODEL_URLS, cloneNode, measure, useModel, useTreatedMaterials } from '../models/modelAssets.js'

/**
 * The billboard surface, and the render-to-texture pass that keeps the
 * interior alive on it.
 *
 * **Why this is not a still.** `technical-architecture.md` is explicit that
 * the room shown on the billboard must never freeze or swap to a static
 * image. The texture here is a real render of the SAME live `scene` object
 * `useThree()` exposes — the actual mounted Environment/CinemaCamera/
 * Monitor graph, with the monitor's video still playing — re-rendered every
 * frame from a fixed viewpoint. Nothing is duplicated, captured or cached.
 * (drei's `<RenderTexture>` was rejected for exactly this reason: it renders
 * a fresh JSX children tree, i.e. a second copy of the room, which is the
 * failure mode the docs warn about for Act 4's re-entry.)
 *
 * **Why the hand-over is invisible.** The reveal is not a dissolve or a
 * cut; it is two images that are the same image at the instant they trade
 * places. Three things make that exact rather than approximate:
 *
 * - The surface is placed `BILLBOARD_VIEW_DISTANCE` directly ahead of
 *   `CAMPAIGNS_SWAP_POSE` — the camera path's own pose at
 *   `CAMPAIGNS_SWAP_T` — and perpendicular to it. Both files derive from
 *   that one shared pose, so they cannot drift apart.
 * - `interiorCamera` sits AT that pose with a frustum framing this quad
 *   exactly (its fov/aspect are computed from the quad's own dimensions and
 *   distance). Both the main camera and the RTT camera therefore render the
 *   interior from the same eye point, and a perspective render from a
 *   shared eye point is consistent across different frustums — so the part
 *   of the texture the main camera sees is pixel-for-pixel what it would
 *   have seen of the real room. This is also why plain 0..1 UVs suffice and
 *   no projective texturing is needed.
 * - The quad is sized to OVERFLOW the main camera's frame at the swap (see
 *   `BILLBOARD_HEIGHT`), so no edge of it is ever in shot at that moment.
 *   Its edges only emerge afterwards, as the camera keeps retreating — and
 *   that emergence IS the reveal.
 *
 * The pose is read from the path rather than captured from the live camera
 * at crossing time, which keeps the whole mechanism a pure function of
 * progress: deterministic, identical every pass, and correct in reverse
 * with no state to reset.
 */

// A real roadside billboard's proportions, and — more importantly — a
// frustum that closely matches the one it has to stand in for.
//
// The quad has to OVERFLOW the main camera's frame at the swap, or its edge
// would be in shot at the very moment it is pretending to be the room. But
// overflow is not free: the render target has to cover the whole quad, so
// every bit of margin is texture spent outside the frame, and the visible
// part is correspondingly softer than the direct view it replaces. An early
// version put the surface 7 units out, which needed a frustum ~1.4x the
// frame vertically and ~1.5x horizontally — barely half the texture landed
// on screen, and an A/B of the two frames either side of the swap showed it
// plainly: a soft image, and visibly different point-sprite sizes in the
// light beam's dust (sprite size scales with viewport height and fov, so a
// mismatched frustum changes them too).
//
// Pushing the surface out to `BILLBOARD_VIEW_DISTANCE` and reshaping it
// brings the required frustum down to ~46.8° vertical against the camera's
// own 45° — a ~5% vertical margin — and, because Three's `fov` is vertical,
// that margin holds at every viewport aspect rather than only this one. The
// 2:1 shape then covers viewport aspects up to ~2.1:1, which spans the
// ordinary desktop/laptop/phone range; genuinely ultrawide viewports (21:9
// and beyond) would see past the quad's sides at the swap. That is a
// deliberate trade — covering them would mean a much wider quad, which
// spends its extra texture entirely off-screen and makes the swap softer
// for everyone else.
//
// The absolute size is set by the view distance, and the view distance is
// now what makes the support pole possible at all. The quad has to reach
// the bottom of the frame at the swap, so its lower edge can never sit
// above the camera's own eye line minus `distance * tan(22.5°)` — a taller
// quad, further out, buries its own base. Bringing it in to 9 keeps the
// board a believable ~15.6m roadside sign whose bottom edge is only 3.9
// below eye height, leaving real room between it and the ground for
// `POLE_HEIGHT`.
const BILLBOARD_WIDTH = 15.6
const BILLBOARD_HEIGHT = 7.8

// Angled off the camera's axis, the way a real roadside board is angled
// toward the traffic it is addressing rather than squared to whoever
// happens to be looking.
//
// The angle costs distance, and that is not a tuning choice. The surface
// has to cover the frame at the swap, and tilting it swings one edge away
// from the camera: at the old 9 units, -10 degrees put the far edge beyond
// what the quad could reach — coverage went to 1.10x needed vertically and
// 1.12x horizontally, i.e. the exterior would have shown around it at the
// one moment the two images must agree. Pulling the surface in to 7.3
// restores ~8% margin at both, WITHOUT changing the board's own dimensions
// or structure. The only side effect is that the board (and the road
// anchored to it) sits ~1.7 further along the rail, which is a shift along
// the road's own length rather than a change to its layout.
// Negative, and by enough to be seen: the board turns toward the highway.
//
// The previous +12 was wrong and the reasoning behind it was the mistake.
// It was chosen to maximise the ANGLE between the board's normal and the
// eye, which it did — but which edge of the board comes toward the viewer
// depends on the SIGN of that angle, not its size, and the sign flips at
// the bearing from the board to the camera (~7.6 degrees here). Above that
// bearing the far edge from the road swings toward you and the board reads
// as turned away from the highway, which is exactly what it looked like. It
// has to sit BELOW that bearing, which means well negative.
//
// At -22 the board's normal points 25 degrees off perpendicular-to-road,
// toward the carriageway — a real roadside angle — and the near edge is the
// one on the highway side. The obliquity that survives is ~9.6 degrees.
// That is less than the +12 version showed, and unavoidably so: the camera
// now stands between the road and the board, which is roughly the direction
// a board facing the road points. Standing where it aims is what makes it
// look flatter; there is no placement that is both in front of it and well
// off its axis.
/**
 * 0, and that is the fix for the match-frame shift rather than a style change.
 *
 * The board used to sit 22 degrees off square. That put the camera's eye OFF
 * the quad's normal, so reproducing the view needed an off-axis frustum —
 * the `QUAD_CENTRE_X` / `setViewOffset` construction below. That maths was
 * derived against the old swap pose and does not survive being repointed at
 * the hero: the residual is a horizontal offset, which is exactly the leftward
 * jump at the hand-over.
 *
 * Square-on removes the problem instead of correcting it. The eye now lies on
 * the quad's normal through its centre, `QUAD_CENTRE_X` falls to zero, the
 * frustum becomes symmetric and UV (0.5, 0.5) maps to screen centre by
 * construction. It is also what the sequence asks for on its own terms — the
 * pull-back is meant to begin square-on with no yaw.
 */
const BILLBOARD_YAW_OFFSET = 0
// Pulled in to hold frame coverage against the turn, with the aspect
// guarantee relaxed from ~2.0 to ~1.85 in the same move — still every
// ordinary desktop, laptop and phone ratio.
//
// Part of the margin is reserved for something that is not about the angle
// at all. The swap fires on the frame the camera crosses the swap plane, and
// a frame is not infinitely thin: at chapter-jump speed the camera travels
// ~0.8 per frame, so it can be up to that far PAST the pose when the
// hand-over happens. Every unit past means the surface is a unit further
// away and covers proportionally less — measured, a 0.42 overshoot scales
// the coverage requirement by 1.068, which at the old 6.2 took 16:9 to
// 100.1% and put a sliver of exterior in the corners. This distance keeps
// that covered.
//
// It is squeezed from both sides and cannot simply be minimised: a nearer
// surface buys coverage margin but makes the same overshoot a larger
// apparent scale error (the surface's distance changes proportionally more
// than the room's does), and it widens the overflow, whose lower half is
// more bare floor in the picture. 5.9 is where those three land.
const BILLBOARD_VIEW_DISTANCE = 5.9



const MAIN_FOV_DEGREES = 45
const BILLBOARD_ASPECT = BILLBOARD_WIDTH / BILLBOARD_HEIGHT

// What fraction of the render target's height the main camera's frame
// occupies at the swap, measured at the surface's centre.
//
// The shortfall from 1.0 is surplus surface outside the frame, and half of
// it sits below — bare floor added under everything the camera saw. Raising
// the surface to push that surplus upward was tried and does not work: the
// binding constraint is the frustum's CORNER rays, which on a tilted
// surface reach much further than the centre column does, leaving a real
// vertical margin of about 0.18 rather than the 1.3 the centre suggests.
// The band at the foot of the board is therefore structural. What can be
// cut is the other source, which is how far back the swap itself stands —
// see `CAMPAIGNS_SWAP_DISTANCE`. The target is
// sized so that fraction comes out at the canvas's own pixel density,
// rather than at a fixed resolution that would be too soft on a large
// display and wasteful on a small one.
//
// The tilt lowers this (0.96 -> 0.78) and so raises the resolution the
// swap wants, because an oblique surface is magnified unevenly: its near
// edge covers more screen per texel than its far edge. Sizing to the centre
// splits that difference. On a high-DPI display the ceiling below now bites
// where it previously did not — a real, if small, cost of the angle.
const VISIBLE_HEIGHT_FRACTION =
  (BILLBOARD_VIEW_DISTANCE * Math.tan(THREE.MathUtils.degToRad(MAIN_FOV_DEGREES / 2))) /
  (BILLBOARD_HEIGHT / 2)

// Ceiling on the long edge. Past the swap the surface shrinks fast and its
// resolution demand collapses with it, so the full-density case lasts an
// instant — not worth an unbounded half-float allocation on a high-DPI
// display. Adaptive quality scaling (technical-architecture.md §15) is
// where a real policy belongs, not here.
//
// Note the target is sized to MATCH the canvas across the visible region,
// never to exceed it. Rendering it larger was tried and measurably made
// things worse: the extra detail has to be minified back down at display
// time, and every texel the sampler skips there is detail that survived in
// the direct view and vanished from the billboard's copy.
const MAX_TARGET_WIDTH = 3072

/**
 * The pose the hand-over happens from — now the MGRT hero rather than Act 3's
 * old backwards rail.
 *
 * Everything downstream is built from these two vectors: the board's centre
 * and yaw, the render-to-texture camera, `BILLBOARD_PLACEMENT`, and through
 * that the whole exterior, which lays itself out against the placement rather
 * than against world coordinates. Repointing this pair therefore moves the
 * board AND the world it stands in as one piece, with their relative design
 * untouched — which is exactly what the reveal needs and why nothing here had
 * to be re-authored.
 *
 * Taken at 16:9. The board is a fixed object in the world, so it cannot track
 * the viewport the way the hero camera does; what makes the hand-over hold at
 * every aspect instead is that the hero is capped closer than the distance at
 * which this board stops covering the frame — see `HERO_MAX_DISTANCE`.
 */
const heroCameraPosition = heroPositionAt(heroDistanceForAspect(16 / 9))
const swapPosition = heroCameraPosition.clone()
const swapFacing = HERO_LOOKAT.clone().sub(heroCameraPosition).normalize()

const billboardCenter = swapPosition.clone().addScaledVector(swapFacing, BILLBOARD_VIEW_DISTANCE)
// A PlaneGeometry faces +Z; this yaw turns it to face back along the
// camera's own locked view direction, then `BILLBOARD_YAW_OFFSET` angles it
// off that.
const billboardRotationY = Math.atan2(-swapFacing.x, -swapFacing.z) + BILLBOARD_YAW_OFFSET

// The surface's own axes. Once it is no longer square-on to the camera,
// these stop being interchangeable with the camera's own and the
// render-to-texture camera has to be built against them instead.
const quadNormal = new THREE.Vector3(Math.sin(billboardRotationY), 0, Math.cos(billboardRotationY))
const quadRight = new THREE.Vector3(Math.cos(billboardRotationY), 0, -Math.sin(billboardRotationY))

// The surface expressed in the frame of a camera sitting at the swap pose
// and looking square at it: one constant depth (because that camera's image
// plane is parallel to the surface) and a centre pushed off-axis by the
// tilt.
const centreOffset = billboardCenter.clone().sub(swapPosition)
const QUAD_DEPTH = -centreOffset.dot(quadNormal)
const QUAD_CENTRE_X = centreOffset.dot(quadRight)
const FULL_HALF_X = Math.max(
  Math.abs(QUAD_CENTRE_X - BILLBOARD_WIDTH / 2),
  Math.abs(QUAD_CENTRE_X + BILLBOARD_WIDTH / 2),
)
const FULL_HALF_Y = BILLBOARD_HEIGHT / 2

// Single central monopole, the way real roadside boards are mounted. Its
// height is what sets the ground plane: the quad's bottom edge is fixed by
// the swap geometry above, so raising the board is impossible — the ground
// is lowered beneath it instead. That leaves the camera ~7.5 above the road
// at the reveal, which is high for a roadside eye line but is what buys a
// visible support at all, and it reads as an embankment view that shows all
// four lanes clearly.
const POLE_HEIGHT = 3.6
const POLE_RADIUS = 0.45

/**
 * Shared with `ExteriorEnvironment.jsx` so the highway is laid out against
 * the billboard's real position rather than a hand-copied coordinate.
 * `groundY` sits `POLE_HEIGHT` below the quad's lower edge, so the pole has
 * somewhere to stand. That the ground is therefore well below the camera's
 * locked eye height costs nothing at the swap — the quad fills the frame
 * there, so no ground is in shot at the moment it would have to match.
 */
export const BILLBOARD_PLACEMENT = {
  center: billboardCenter.toArray(),
  rotationY: billboardRotationY,
  width: BILLBOARD_WIDTH,
  height: BILLBOARD_HEIGHT,
  groundY: billboardCenter.y - BILLBOARD_HEIGHT / 2 - POLE_HEIGHT,
}

const FRAME_THICKNESS = 0.35

// Three lamps evenly spaced along the lower edge, throwing up at the board.
// They sit BELOW that edge on short arms, which matters for more than looks:
// the quad's bottom edge is already just outside the frame at the swap, so
// anything mounted on top of it would clip back into shot at the one moment
// the billboard has to be indistinguishable from the room. Hanging them
// under the frame keeps them clear with room to spare.
// How bright the lamps' wash on the board face is allowed to get, and how
// much scroll progress past the swap it takes to get there.
//
// The wash has to be exactly zero AT the swap. An earlier version left the
// board's diffuse term on permanently and the A/B caught it immediately:
// three lamp pools sat across the lower frame in the billboard's version
// and nowhere in the real room's, which is precisely the kind of tell the
// whole swap design exists to avoid. Ramping it in afterwards — a plain
// smoothstep of progress, the same mechanism `DIGITAL_IGNITE_RISE` uses for
// the monitor — keeps the hand-over pixel-identical and stays a pure
// function of progress, so it is correct in reverse with nothing to reset.
// By the time the wash is fully up the board is small in frame, so it reads
// as lamps that were always on rather than lamps coming on.
const LAMP_WASH_LEVEL = 0.11
/**
 * How much progress the wash takes to come up, now the rail it used to be
 * measured along is gone. The reveal spans 0.9 to 1.0, so this brings the
 * lamps in over roughly the first third of the pull-back.
 */
const LAMP_WASH_RISE = 0.035

// How far before the swap the interior pass starts running, in rail units.
// Measured on the camera rather than on scroll progress for the same reason
// the swap itself is (see `campaignsRailDistance`): progress can fall back
// below a progress-based gate while the camera is still past the swap and
// the billboard is still on screen, which would leave the surface showing a
// frozen frame. A camera-based lead-in cannot get out of step with the
// camera.


const LAMP_COUNT = 3
const LAMP_DROP = 0.45
const LAMP_REACH = 0.95

/**
 * One up-lighter: housing, lens, arm, and the spot itself.
 *
 * The board's own face is `meshBasicMaterial` and cannot receive light —
 * that is not an oversight, it is the same property that makes the reveal
 * seamless (its pixels arrive already lit by the render that produced
 * them). So these read the way lamps on an unlit sign actually read at
 * night: visible fixtures, light on the frame, the pole and the ground
 * around the base. Kept deliberately dim — `distance` and `decay` do most
 * of the shaping, so the pool stays local to the structure instead of
 * washing the whole exterior.
 */
function BillboardLamp({ x, boardHeight }) {
  const light = useRef(null)
  const target = useRef(null)
  useLayoutEffect(() => {
    if (light.current && target.current) light.current.target = target.current
  }, [])

  const y = -boardHeight / 2 - LAMP_DROP

  return (
    <group position={[x, y, 0]}>
      {/* Arm back to the frame's lower rail. */}
      <mesh position={[0, LAMP_DROP / 2, LAMP_REACH / 2]}>
        <boxGeometry args={[0.1, LAMP_DROP, 0.1]} />
        <meshStandardMaterial color="#17171a" roughness={0.8} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, LAMP_REACH]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.62, 0.24, 0.3]} />
        <meshStandardMaterial color="#1b1b1e" roughness={0.7} metalness={0.35} />
      </mesh>
      {/* The lens — the only genuinely bright element, and small enough
          that it reads as a fitting rather than a bloom source. */}
      <mesh position={[0, 0.11, LAMP_REACH + 0.03]} rotation={[-0.55, 0, 0]}>
        <planeGeometry args={[0.52, 0.17]} />
        <meshBasicMaterial color="#d8c49a" toneMapped={false} />
      </mesh>
      <spotLight
        position={[0, 0.1, LAMP_REACH]}
        angle={1.0}
        penumbra={0.95}
        decay={2}
        distance={16}
        intensity={26}
        color="#e8d9bb"
        ref={light}
      />
      <object3D ref={target} position={[0, boardHeight * 0.55, 0.1]} />
    </group>
  )
}

/**
 * The billboard's support structure, from `campaign-billboard.glb`.
 *
 * Fitted by matching the model's own ad panel to this project's face
 * width, so the structure lands at roughly the size the monopole it
 * replaces occupied, and positioned so that panel sits directly behind
 * the face. The model's panel mesh itself is hidden — see the render tree
 * for why the render-to-texture face cannot be replaced by it.
 *
 * The model's proportions are not this board's: its panel is 7.12 x 2.53
 * (2.8:1) where the face is a locked 2:1, and its legs are long relative
 * to the panel. Matching the width is the closest fit that leaves the
 * face — the one dimension the reveal depends on — untouched.
 */
const MODEL_PANEL_NODE = 'ADs_AD_0'
const MODEL_STRUCTURE_NODES = ['Main_Billboard_Main_0', 'Walkway_Walkway_Grate_0']

function useBillboardStructure() {
  const gltf = useModel(MODEL_URLS.billboard)

  return useMemo(() => {
    const group = new THREE.Group()
    const panel = cloneNode(gltf, MODEL_PANEL_NODE)
    const parts = MODEL_STRUCTURE_NODES.map((name) => cloneNode(gltf, name)).filter(Boolean)
    if (!panel || !parts.length) return group
    group.add(panel, ...parts)

    const authored = measure(panel)
    group.scale.setScalar(BILLBOARD_WIDTH / authored.size.x)

    const scaled = measure(panel)
    group.position.x -= scaled.center.x
    group.position.y -= scaled.center.y
    // Set behind the face, deep enough that the model's own panel and
    // frame cannot z-fight with it.
    group.position.z -= scaled.box.max.z + 0.12

    panel.visible = false
    return group
  }, [gltf])
}

/** Dark painted steel — the finish the monopole it replaces had. */
function structureTreatment(material) {
  material.roughness = Math.max(material.roughness ?? 1, 0.7)
  material.metalness = Math.min(material.metalness ?? 0, 0.4)
  if (material.color) material.color.multiplyScalar(0.32)
}

export default function Billboard() {
  const { gl, scene } = useThree()
  const applyExteriorLayer = useExteriorLayer()
  const faceMaterial = useRef(null)
  const structure = useBillboardStructure()

  // Dark painted steel, so the structure sits in the same night as the
  // road and the sky rather than reading as a lit object beside them.
  useTreatedMaterials(structure, structureTreatment)

  const renderTarget = useMemo(() => {
    // Sized once, here, and never resized. `setSize` disposes and
    // reallocates the attachment while leaving the texture's own version
    // untouched, so a material already sampling it can be left holding
    // state from the previous allocation — a hazard worth designing out
    // rather than managing, and avoidable entirely since `gl` is available
    // at construction. The cost is that the target does not follow a window
    // resize; a resize mid-pull-back is rare enough to accept that.
    //
    // This is where the monitor's screen was long recorded as arriving
    // wrong, and it was never a resolution problem — see
    // `screenVideoMaterial.js` for what it actually was and where it is now
    // fixed. Measured at the swap with the video paused, every room surface
    // matched the direct view to within ~5% while the screen sat 51%
    // brighter; that gap is now closed, and what remains is the softness
    // this target's size buys, which is a different thing.
    const buffer = gl.getDrawingBufferSize(new THREE.Vector2())
    // Match the canvas across the region that will actually be on screen,
    // never exceed it — rendering larger only means minifying back down at
    // display time, and every texel the sampler skips there is detail that
    // survived in the direct view and vanished from the billboard's copy.
    const height = Math.min(
      Math.round(buffer.y / VISIBLE_HEIGHT_FRACTION),
      Math.round(MAX_TARGET_WIDTH / BILLBOARD_ASPECT),
    )

    // Half-float, not the default 8-bit. Three skips tone mapping when
    // rendering into a render target (it assumes you will map later), so the
    // interior arrives here as raw linear HDR — and an 8-bit target would
    // clip everything above 1.0 before the billboard's own tone-mapping pass
    // could roll it off. The volumetric beam, its dust and the monitor's own
    // screen are exactly the values that live above 1.0. Keeping the target
    // linear and high-range means texture -> material reproduces the direct
    // render's pipeline exactly (linear -> ACES -> sRGB), one pass, in the
    // same order. The monitor's screen needs the headroom for a second
    // reason — `screenVideoMaterial.js` writes a pre-compensated value there
    // that reaches ~15.4 for white.
    //
    // Plain `LinearFilter`, no mipmaps: the visible region is already at
    // parity with the canvas at the swap, so there is essentially nothing to
    // minify there and any blend toward a lower mip is pure lost detail —
    // mipmapping was tried and measurably hurt. The cost is some aliasing
    // once the board shrinks later in the pull-back, which is the right way
    // round: the swap has to be exact, the distant board only has to look
    // like a billboard.
    return new THREE.WebGLRenderTarget(Math.round(height * BILLBOARD_ASPECT), height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      type: THREE.HalfFloatType,
    })
  }, [gl])

  const captured = useRef(null)

  const interiorCamera = useMemo(() => {
    // Aimed square at the surface, NOT along the main camera's view axis —
    // the one thing the tilt genuinely forces. The seamless hand-over rests
    // on plain 0..1 UVs mapping linearly onto the quad, and that only holds
    // while the image plane is parallel to the quad. Point this camera down
    // the main camera's axis instead and the room arrives keystoned. The eye
    // point is still the swap pose, which is what actually makes the two
    // images agree: a perspective render from a shared eye point is
    // consistent whatever direction its frustum faces.
    //
    // The tilt then pushes the surface off this camera's own axis, so the
    // frustum has to be asymmetric. `setViewOffset` expresses that directly
    // — a symmetric frustum wide enough to contain the surface, windowed
    // down to the surface itself — which keeps the rendered image exactly
    // the quad and the UVs exactly linear.
    const camera = new THREE.PerspectiveCamera(
      THREE.MathUtils.radToDeg(2 * Math.atan(FULL_HALF_Y / QUAD_DEPTH)),
      FULL_HALF_X / FULL_HALF_Y,
      0.05,
      100,
    )
    camera.position.copy(swapPosition)
    camera.lookAt(swapPosition.clone().sub(quadNormal))
    camera.setViewOffset(
      FULL_HALF_X * 2,
      FULL_HALF_Y * 2,
      QUAD_CENTRE_X - BILLBOARD_WIDTH / 2 + FULL_HALF_X,
      0,
      BILLBOARD_WIDTH,
      BILLBOARD_HEIGHT,
    )
    // Interior only — this camera cannot see the billboard it feeds, or the
    // exterior world, so there is no feedback loop to guard against.
    camera.layers.set(0)
    return camera
  }, [])

  useEffect(() => () => renderTarget.dispose(), [renderTarget])

  useFrame(({ camera }) => {


    // Zero added cost outside Act 3: no extra scene pass at all during
    // Intro, Film or Digital. The lead-in means the surface is already
    // showing a current frame by the time it can first be seen, in either
    // scroll direction.
    /**
     * Captured ONCE, not re-rendered every frame.
     *
     * The old scheme kept a live copy of the room on the surface because the
     * camera was retreating down the room and the view behind it kept
     * changing. Nothing changes here: the board carries one still composition
     * — the wall, square on, exactly as the hero framed it — and once the
     * camera starts pulling back that image has to stay locked to the BOARD.
     * Re-rendering it from the moving camera would keep it locked to the
     * SCREEN instead, so the picture would appear to zoom in as the board
     * shrank, and the object would never resolve as a printed surface.
     *
     * Taken DURING the hero hold, which is the only correct moment. The camera
     * is frozen on the canonical hero pose there, so what lands in the render
     * target is the exact final interior frame the billboard has to impersonate
     * an instant later — not an approximation of it taken on the way in. It is
     * also invisible, because the board is still on a layer the camera is not
     * looking at.
     *
     * One extra scene render for the whole sequence. That also removes the
     * per-frame second scene pass Act 3 used to cost, which is the single
     * biggest thing this phase gives back to Safari.
     */
    if (!isHeroCaptureWindow()) return
    if (captured.current !== camera.aspect) {
      captured.current = camera.aspect
      gl.setRenderTarget(renderTarget)
      gl.render(scene, interiorCamera)
      gl.setRenderTarget(null)
    }
    // Reported even when this aspect was already captured, so a section flight
    // waiting at the hero knows the board is ready to stand in for the wall.
    markHeroCaptured(camera.aspect)
  })

  const [cx, cy, cz] = BILLBOARD_PLACEMENT.center

  return (
    <group ref={applyExteriorLayer} position={[cx, cy, cz]} rotation={[0, billboardRotationY, 0]}>
      {/* The image surface — UNLIT, and that is the fix for the grey cast.
          It was a `meshStandardMaterial` so the up-lighters below had
          something to fall on, with a near-black `color` keeping the diffuse
          term tiny. But a standard material also receives the ENVIRONMENT, and
          `scene.environment` is the sky HDRI at 0.40 — and the specular part
          of an IBL does not scale with `color`. It depends only on roughness
          and metalness, so it laid a uniform reflected sheen across the board
          that no amount of darkening the colour could remove. That sheen is
          the "thin grey film": lower contrast, flatter, washed out, appearing
          the instant the swap happens.
          A basic material cannot receive light, environment or otherwise, so
          the captured pixels reach the frame buffer exactly as rendered.
          `toneMapped` is deliberately left ON: three skips tone mapping for
          materials whose destination is a render target, so the texture holds
          linear scene values and `OutputPass` maps them once — the same single
          mapping the direct view gets. No double conversion in either path.
          The cost is that the lamps no longer wash the image, which is the
          intended trade: the structure stays physically lit, the display
          reproduces the frame. */}
      <mesh>
        <planeGeometry args={[BILLBOARD_WIDTH, BILLBOARD_HEIGHT]} />
        <meshBasicMaterial map={renderTarget.texture} fog={false} />
      </mesh>
      {/* Structural frame, set slightly behind the face so it reads as a
          surround rather than z-fighting with it. Outside the face's own
          bounds, so it is off-screen at the swap and only appears with the
          reveal. */}
      {/* Casts the board's shadow onto the ground in daylight (the image face
          is unlit and does not). */}
      <mesh position={[0, 0, -0.05]} castShadow>
        <planeGeometry args={[BILLBOARD_WIDTH + FRAME_THICKNESS * 2, BILLBOARD_HEIGHT + FRAME_THICKNESS * 2]} />
        <meshStandardMaterial color="#1c1c1f" roughness={0.85} metalness={0.15} />
      </mesh>

      {/* Support structure (campaign-billboard.glb), replacing the
          procedural monopole and its footing.

          The model's own ad panel is hidden and this project's
          render-to-texture face is kept — that face is the reveal
          mechanism, not decoration: its size, distance and squareness to
          `CAMPAIGNS_SWAP_POSE` are what make the hand-over from the real
          room to the billboard exact, and it cannot be swapped for a
          panel with different dimensions without breaking the swap.

          Scaled so the model's panel matches this face's width, which
          keeps the structure's on-screen size close to the monopole it
          replaces. Its legs then run deeper than the 3.6 the pole did and
          simply continue below the ground line, which is invisible and
          cheaper than rescaling the whole model to make its footing land
          exactly on the terrain. */}
      <primitive object={structure} />

      {Array.from({ length: LAMP_COUNT }, (_, i) => (
        <BillboardLamp
          key={i}
          // Evenly spaced across the board's width, inset half a slot from
          // each end so the outer two sit over the board rather than at its
          // corners.
          x={BILLBOARD_WIDTH * ((i + 0.5) / LAMP_COUNT - 0.5)}
          boardHeight={BILLBOARD_HEIGHT}
        />
      ))}
    </group>
  )
}
