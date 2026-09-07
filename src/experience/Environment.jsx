import * as THREE from 'three'
import { useMemo } from 'react'
import VolumetricLightingRig from './lighting/VolumetricLightingRig.jsx'
import SceneEnvironment from './lighting/SceneEnvironment.jsx'
import { buildColumnGeometry } from './architecture/columnGeometry.js'
import { buildColumnCollar, buildWallSkirt } from './architecture/contactDebris.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createStoneWallMaterial, stoneRepeatForSize } from './materials/stoneWallMaterial.js'
import { buildGalleryShellGeometry, GALLERY_SHELL } from './architecture/galleryShellGeometry.js'

// Widened/deepened (14x32 -> 20x38) per explicit request: the previous
// dimensions left almost no room for a genuine wide establishing orbit
// outside the pillar ring — §4BD's exterior orbit was already pushed to
// 6.9, a mere 0.1 from these old ±7 walls. "If the existing room is too
// small... increase the room dimensions... preserve the existing
// architectural proportions" — the production ensemble itself
// (`BEAM_CENTER`/`Monitor.jsx`/`CinemaCamera.jsx`) is untouched, at its
// same absolute position; only the surrounding architecture grows around
// it, which is also what gives the pillar ring (below) room to grow too.
export const HALL_WIDTH = 20
export const HALL_DEPTH = 38
export const HALL_HEIGHT = 9

/**
 * Three-tier surface tonality, lightest to darkest: columns catch the most
 * ambient light and draw primary focus, walls sit at a mid charcoal tone
 * for depth/boundary readability, and the floor stays darkest so the
 * volumetric light pool and column bases stand out against it.
 */
const SURFACE_TONE = {
  // Column and floor tints re-derived when those two surfaces moved from
  // flat colours onto the procedural stone material. These values are
  // multiplied INTO that material's own albedo (base ~#948c7c, shaded
  // 0.4-1.18 by the height field), so the same number that read correctly
  // as a final colour reads roughly half as bright as a tint — the floor
  // and columns both dropped visibly on the first pass. Raised to restore
  // their previous apparent brightness and, with it, the approved
  // three-tier order: columns lightest, walls mid, floor darkest.
  //
  // `wallBack`/`wallSide` are deliberately untouched: those were always
  // tints on this material, so they are already calibrated for it, and
  // they carry the Phase 1B tonality approval.
  column: '#c4c4c4',
  wallBack: '#5e5e5e',
  wallSide: '#565656',
  floor: '#8a8a8a',
}

/**
 * Full circular pillar ring — replaces the previous half-moon arc PLUS a
 * separate foreground "entrance pillar" pair, per explicit request: "the
 * room should contain one complete circular ring of pillars... there
 * should not be a separate pair of pillars specifically placed behind the
 * user's starting position... the circle itself is the architecture."
 *
 * `PILLAR_RING_CENTER`/`PILLAR_RING_RADIUS` are exported so
 * `cameraPath.js`'s new exterior-orbit entrance can derive its own path
 * (and the exact gap it enters through) from this ring's real geometry
 * rather than a second, independently guessed set of numbers — the same
 * "use the project's actual positions" principle already applied to the
 * Cinema Camera/Monitor anchors.
 *
 * Radius raised again, 4.6 -> 5.5, alongside this round's `HALL_WIDTH`/
 * `HALL_DEPTH` increase (see those constants' own comment) — the same
 * "far + low + wide" request that's been the throughline of every recent
 * camera-path round finally gets real room to work in: with the wider
 * hall, `cameraPath.js`'s exterior `ORBIT_RADIUS` no longer has to sit a
 * bare 0.1 from the walls to be "far from the pillars" — see that file's
 * own comment for the new numbers.
 *
 * 12 pillars at exactly 30° apart (unchanged spacing philosophy from the
 * previous arc's ~26.7°) is also a deliberate number: it happens to place
 * a natural gap close to the Cinema Camera lens's own real optical axis
 * (see `cameraPath.js`'s gate-angle derivation) — the "gate" the entrance
 * path enters through is a genuine gap this arrangement already has, not
 * an invented doorway cut into the ring.
 */
export const PILLAR_RING_CENTER = [0, -4]
export const PILLAR_RING_RADIUS = 5.5
export const PILLAR_COUNT = 12

const pillarPositions = Array.from({ length: PILLAR_COUNT }, (_, i) => {
  const angle = THREE.MathUtils.degToRad((360 / PILLAR_COUNT) * i)
  const x = PILLAR_RING_CENTER[0] + PILLAR_RING_RADIUS * Math.sin(angle)
  const z = PILLAR_RING_CENTER[1] - PILLAR_RING_RADIUS * Math.cos(angle)
  return [x, z]
})

/**
 * A simple classical column profile (plinth -> shaft with a subtle taper ->
 * capital), revolved into a single restrained LatheGeometry. Deliberately
 * plain — no fluting, carving, or ornamentation — and shared across every
 * column instance rather than rebuilt per-mesh.
 *
 * The taper and the rounded plinth/capital transitions are what keep the
 * ring from reading as twelve cylinders: they give each column a silhouette
 * that changes with height, which is the same reason the shell around them
 * curves rather than meeting at corners.
 */
export const PILLAR_SHAFT_RADIUS = 0.26


/**
 * The floor, displaced by a low-frequency noise field so it is a surface
 * rather than a plane.
 *
 * The amplitude is deliberately tiny (`FLOOR_RELIEF`, in centimetres, not
 * tens of centimetres). It is not meant to be seen as terrain — everything
 * in this room stands on this floor at y = 0, and the plinths, the column
 * bases and the light pool would all break contact with it if it moved
 * enough to notice directly. What it is for is the grazing light: the key
 * light arrives at a shallow angle through the breach, and across a
 * perfectly flat plane that produces a perfectly even wash, which is the
 * single strongest "this is a 3D primitive" cue in the room. A few
 * centimetres of relief is enough for that wash to break up into something
 * that reads as a real, slightly uneven stone floor.
 */
const FLOOR_RELIEF = 0.05

/**
 * A slow swell across the whole hall, on top of the fine relief.
 *
 * The fine relief alone reads as texture; what a floor of this age also
 * has is SETTLEMENT — long, shallow undulations tens of metres across,
 * far too gradual to see directly but enough that a grazing light never
 * crosses a truly flat run. This is the part that removes the last of the
 * "primitive" read from the floor, because a plane with bumps on it is
 * still, unmistakably, a plane.
 *
 * Kept to `FLOOR_SETTLE` because everything in the room stands at y = 0:
 * the plinths, the column bases and the light pool all break contact with
 * the floor if it moves further than this.
 */
const FLOOR_SETTLE = 0.11

function useFloorGeometry() {
  return useMemo(() => {
    // Denser than the previous 120 x 220: the long swell below needs
    // enough vertices to resolve as a curve rather than as facets, and the
    // whole thing is built once at mount.
    const geometry = new THREE.PlaneGeometry(HALL_WIDTH, HALL_DEPTH, 170, 320)
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i)
      const y = position.getY(i)
      // Two octaves at incommensurate frequencies, so the relief never
      // repeats visibly across the hall's length.
      const relief =
        Math.sin(x * 0.42 + 1.7) * Math.cos(y * 0.31 - 0.4) * 0.6 +
        Math.sin(x * 1.13 - 2.2) * Math.cos(y * 0.87 + 1.1) * 0.4
      // Wavelengths on the order of the room itself.
      const settle =
        Math.sin(x * 0.13 - 0.9) * Math.cos(y * 0.077 + 2.4) * 0.65 +
        Math.sin(x * 0.061 + 3.1) * Math.cos(y * 0.115 - 1.3) * 0.35
      position.setZ(i, relief * FLOOR_RELIEF + settle * FLOOR_SETTLE)
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
  }, [])
}

/**
 * Persistent architectural shell: a curved, vaulted gallery enclosure,
 * a relieved stone floor, and the structural column ring.
 *
 * The hall's approved Phase 1A footprint (20 x 38 x 9) is preserved
 * exactly — `galleryShellGeometry.js` curves *within* that envelope rather
 * than moving it, which is what keeps `cameraPath.js`'s keyframes, the
 * pillar-clearance guarantees and the billboard's framing valid without
 * re-derivation. What changed is the form, not the volume: five flat
 * planes meeting at hard corners, open to the void above, became one
 * continuous swept surface that rises into a barrel vault. See that
 * module for the plan curve, the vault profile and how both openings —
 * the front mouth the camera leaves through, and the fractured breach the
 * key light arrives through — are cut from the same sheet.
 *
 * The three-tier tonality from `SURFACE_TONE` is preserved (columns
 * lightest, walls mid, floor darkest), still applied as a tint multiplied
 * over the procedural stone albedo — that part of Phase 1B's approval
 * survives this pass intact.
 *
 * Every surface in the room is now PBR. The floor and columns previously
 * carried flat `meshStandardMaterial` colours with no maps at all, which
 * is why they read as primitives next to the already-textured walls: a
 * colour with uniform roughness has no surface, and the eye reads the
 * silhouette instead. Both now take the same procedural stone treatment
 * the walls use, tuned per surface — a large, low-relief repeat for the
 * floor (worn slabs underfoot, not rubble) and a tight, very low-relief
 * one for the columns (dressed stone, so the normal map grazes rather
 * than roughens their silhouette).
 */
/** A stable per-column turn, so no two present the same face to the light. */
function columnYaw(index) {
  const value = Math.sin(index * 127.1 + 3.7) * 43758.5453
  return (value - Math.floor(value)) * Math.PI * 2
}

export default function Environment() {
  /**
   * The ring is drawn as one batch per material instead of one per column.
   *
   * Twelve columns and twelve debris collars were twenty-four draw calls for
   * geometry that never moves. Baking each column's own position and yaw into
   * its vertices and merging by material collapses that to four — three column
   * batches (one per tint variant) and one for the collars.
   *
   * Every column keeps its own geometry: the merge concatenates the twelve
   * distinct meshes, it does not instance one of them. Nothing about the
   * per-column condition, erosion, drum offsets or rotation is lost, which is
   * also why `InstancedMesh` was not the tool here — instancing requires a
   * SHARED geometry, and the whole point of these columns is that no two are
   * the same object.
   *
   * The cost is frustum culling: a merged batch is drawn whenever any part of
   * it is on screen. For a ring the camera spends the sequence inside, most of
   * it is on screen most of the time anyway, so there was little culling to
   * lose.
   */
  const mergedColumns = useMemo(() => {
    const byMaterial = Array.from({ length: 3 }, () => [])
    pillarPositions.forEach(([x, z], i) => {
      const geometry = buildColumnGeometry(HALL_HEIGHT, i, PILLAR_SHAFT_RADIUS)
      geometry.rotateY(columnYaw(i))
      geometry.translate(x, 0, z)
      byMaterial[i % 3].push(geometry)
    })
    return byMaterial.map((group) => mergeGeometries(group, false))
  }, [])

  const mergedCollars = useMemo(() => {
    const parts = pillarPositions.map(([x, z], i) => {
      const geometry = buildColumnCollar(0.4, i)
      geometry.translate(x, 0, z)
      return geometry
    })
    return mergeGeometries(parts, false)
  }, [])
  const wallSkirtGeometry = useMemo(() => buildWallSkirt(), [])
  const floorGeometry = useFloorGeometry()
  const shellGeometry = useMemo(() => buildGalleryShellGeometry(), [])

  // One material for the whole shell. The five per-segment materials this
  // replaces existed so each flat wall could size its own texture repeat
  // to its own width; a single swept surface has one continuous UV
  // parameterisation, so it needs — and can only have — one.
  const shellMaterial = useMemo(() => {
    // Tint far closer to white than `SURFACE_TONE.wallSide`, for the same
    // reason as the floor: that value was lifting an artificially dark
    // generated albedo, and the scanned quarry stone is already a dark brown.
    const material = createStoneWallMaterial(
      '#a8a49c',
      stoneRepeatForSize(HALL_DEPTH * 2, GALLERY_SHELL.crownHeight),
      [1.4, 1.4],
      { scanned: 'walls' },
    )
    return material
  }, [])
  const floorMaterial = useMemo(
    // Low `normalScale`: a floor lit at a grazing angle exaggerates its own
    // normal map badly, and at the walls' 1.4 the slabs read as gravel.
    //
    // Tint is much closer to white than `SURFACE_TONE.floor`: that value was
    // dragging an artificially dark generated albedo down to the room's
    // darkest tier, and the scanned concrete is already a dark worn brown of
    // its own. Multiplying the two put the floor at near-black.
    () =>
      createStoneWallMaterial('#b0aca4', stoneRepeatForSize(HALL_WIDTH, HALL_DEPTH), [0.45, 0.45], {
        scanned: 'floors',
      }),
    [],
  )
  // Columns use the drum bond, not ashlar — see `stoneAt`. `repeat` is
  // [1, ...] around the shaft so no vertical seam runs up it, and the
  // vertical count is chosen so the bed joints land at believable drum
  // heights against a 9-unit column rather than at the wall's stone scale.
  // Three column materials, not one. The drum bond and the erosion cut are
  // real now — the previous `'drum'` argument was passed to a factory whose
  // signature stopped at three parameters, so it was silently discarded and
  // every column carried the walls' ashlar grid, complete with the vertical
  // joints a turned drum cannot have.
  //
  // The variants differ only in tint and how hard the weathering bites. That
  // is enough to stop twelve shafts sharing one set of stains, and it costs
  // three 256px texture builds at mount. `normalScale` is up from 0.55: the
  // chipping exists to be seen raking across the surface, and at the old
  // value it flattened out.
  //
  // The vertical repeat is what sets drum height: at the previous 2.6 the
  // bed joints fell ~3.5 units apart on a 9-unit shaft, which is not a
  // course of masonry, it is three faint bands. Around 9 puts a joint every
  // metre or so — the size a drum that two people have to move actually is.
  const columnMaterials = useMemo(
    () => [
      // Tints are much darker than the generated-texture variants they
      // replace. `SURFACE_TONE.column` and friends were lifting a nearly
      // black procedural albedo into view; the scanned marble is bright
      // cream, so the same tints put the columns several stops above the
      // room. These sit them back in its value range without touching the
      // lighting the rest of the room is balanced against.
      // The V repeats are set for a square tile, not for joint spacing. One
      // wrap of U spans the shaft's circumference (~1.6 units), so V has to
      // cover the 9-unit height at the same units-per-tile or the scan
      // stretches vertically — which read as timber grain rather than stone.
      createStoneWallMaterial('#5d5952', [1, 5.5], [1.6, 1.6], { bond: 'drum', erosion: 0.8, stain: 0.85, scanned: 'columns' }),
      createStoneWallMaterial('#565049', [1, 6.0], [1.8, 1.8], { bond: 'drum', erosion: 1.0, stain: 1.0, scanned: 'columns' }),
      createStoneWallMaterial('#66605a', [1, 5.0], [1.45, 1.45], { bond: 'drum', erosion: 0.6, stain: 0.7, scanned: 'columns' }),
    ],
    [],
  )

  // Debris shares the floor's scan, because debris on a floor IS floor. The
  // repeat is expressed per world unit rather than per mesh: `contactDebris`
  // writes world X/Z straight into its UVs, so passing 1 / TILE_SIZE lands the
  // texture at exactly the density the floor plane carries. Any other value
  // and the join announces itself as a change of texture scale, which is
  // precisely the seam this geometry exists to hide.
  const debrisMaterial = useMemo(
    () => createStoneWallMaterial('#b0aca4', [1 / 1.4, 1 / 1.4], [0.45, 0.45], { scanned: 'floors' }),
    [],
  )

  return (
    <group>
      <SceneEnvironment />
      <VolumetricLightingRig />

      {/* Floor — darkest tier, relieved rather than flat (see useFloorGeometry) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={floorGeometry} material={floorMaterial} receiveShadow />

      {/* The gallery shell — curved walls rising into a vault, with the
          front mouth and the breach cut from the same surface.
          `receiveShadow` only, matching the flat walls it replaces: the
          key light sits 0.025 inside this surface (it shines *through* the
          breach), so a shell that cast shadows would put itself between
          the light and the entire room and black the space out — which is
          exactly what it did when first wired up. */}
      <mesh geometry={shellGeometry} material={shellMaterial} receiveShadow />

      {/*
        Full column ring — lightest tier, surrounds the production space.

        Each column is turned by its own amount. They share one geometry and
        one material, so without this every column presents the identical
        face, the identical stone and the identical wear to the light — a
        row of clones, which is the strongest remaining "instanced
        primitive" cue in the room once the surfaces themselves are aged.
        Rotation alone is enough to break it, and it is also the only
        transform that is free of consequences here: positions feed
        `cameraPath.js`'s pillar-clearance derivation and the radius feeds
        `PILLAR_SHAFT_RADIUS`, so neither is touched. A column turned about
        its own axis occupies exactly the same space.
      */}
      {/* Debris banked against the foot of the shell. `castShadow` is off on
          both contact meshes: they are centimetres tall, so their own shadows
          add nothing but noise to the map, while receiving is what actually
          seats them into the floor. */}
      <mesh geometry={wallSkirtGeometry} material={debrisMaterial} receiveShadow />
      <mesh geometry={mergedCollars} material={debrisMaterial} receiveShadow />

      {/*
        Full column ring — lightest tier, surrounds the production space.

        Three meshes, twelve columns: each column's own yaw and position are
        baked into its vertices and the results merged per material. See
        `mergedColumns` for why this is a merge rather than instancing.
      */}
      {mergedColumns.map((geometry, i) => (
        <mesh
          key={`columns-${i}`}
          geometry={geometry}
          material={columnMaterials[i]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
