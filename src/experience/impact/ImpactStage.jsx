import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { lightingParams } from '../lighting/volumetricLighting.js'
import { PRINT_THICKNESS, TABLE, ZONES, stage } from './impactStage.js'
import { heroPlate, heroPlateTexture } from './heroPlate.js'
import { tableWoodMaps } from './tableWood.js'

/**
 * The creative-direction table, and the print of the hero frame lying on it.
 *
 * Nothing else. The zones the other two clusters will occupy are reserved in
 * `impactStage.js` and deliberately left empty here: the composition this
 * phase settles on has to be one that already has room for them, which is only
 * demonstrable while they are still absent.
 *
 * The set sits in world space wherever `impactStage` put it — directly under
 * the hero camera, inside the room's volume — and is only ever drawn while the
 * room is not (`ImpactStage` and the room swap in one step, see
 * `roomVisibility.js`). That is why there is a floor here and no walls: beyond
 * the reach of the table's own light there is meant to be nothing.
 */

/**
 * How the print stops being the room and becomes a sheet of paper.
 *
 * At the handoff it is pure emission — the captured frame, put back into the
 * buffer exactly as it came out (see `heroPlate.js`) — with no light on it at
 * all, because at that instant it IS the previous frame and anything added
 * would be a difference the eye can find. The emission then falls away as the
 * table's own light comes up in its place, the two crossing over so that the
 * picture's brightness is carried continuously from one to the other.
 *
 * Driven by how far the camera has actually TRAVELLED, not by raw progress.
 * The pull-back is deliberately almost stationary at first (see `revealEase`),
 * so a crossover on raw progress would dim the picture by a fifth while the
 * frame was still supposed to be indistinguishable from the room — measured,
 * before this was fixed, as the single largest difference across the cut.
 */
const CROSSOVER_END = 0.2

export default function ImpactStage({ groupRef }) {
  // `groupRef` is a callback ref owned by `CinematicExperience` (it registers
  // the node for the set swap); this keeps our own handle for the frame loop.
  const selfRef = useRef(null)
  const attach = useCallback(
    (node) => {
      selfRef.current = node
      groupRef(node)
    },
    [groupRef],
  )
  const printRef = useRef(null)
  const roomFaceRef = useRef(null)
  const keyRef = useRef(null)
  const fillRef = useRef(null)
  const bounceRef = useRef(null)
  const revision = useRef(-1)

  const wood = useMemo(() => tableWoodMaps(), [])

  const materials = useMemo(() => {
    const top = new THREE.MeshStandardMaterial({
      map: wood.colour,
      roughnessMap: wood.roughness,
      roughness: 1,
      metalness: 0,
      color: 0xffffff,
    })
    // The grain runs the length of the table; the maps are square, so the
    // repeat is what gives the boards their proportion.
    top.map.repeat.set(1.2, 0.85)
    top.roughnessMap.repeat.set(1.2, 0.85)

    const frame = new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 0.62, metalness: 0.08 })

    // The room beyond the table: present, but only just. Rough and almost
    // black, so it takes the key light's falloff and nothing else — the
    // "intentionally lit rather than floating in a void" the brief asks for
    // comes from this catching a little light near the table and none at all
    // further out.
    const floor = new THREE.MeshStandardMaterial({ color: 0x2b2219, roughness: 0.88, metalness: 0 })

    /**
     * The print, as two coincident surfaces that cross-dissolve.
     *
     * `paper` is the honest one: the captured frame as the albedo of a matte
     * sheet, lit by the table's key, taking its shadow and its falloff like
     * any other object on the table. It is what the print IS.
     *
     * `roomFace` is an unlit copy laid a hundredth of a millimetre above it,
     * carrying the same frame with no shading at all — the buffer's own values
     * put straight back into the buffer (see `heroPlate.js`), which the output
     * pass then tone-maps exactly once, as it did the first time. That is what
     * makes the handoff survive measurement: the lit material, even with every
     * light in the scene at zero, renders the same still about 19/255 brighter
     * than the frame it is replacing, and the eye finds a whole-frame lift of
     * that size immediately. Measured across the cut: 19.1 mean absolute
     * difference through the lit material, 0.07 through this one.
     *
     * So the room phase is drawn by `roomFace` and the paper phase by `paper`,
     * and the move dissolves between them while the two are still showing the
     * same picture at the same size — which is the one moment at which a
     * dissolve between them cannot be seen.
     */
    const paper = new THREE.MeshStandardMaterial({
      map: heroPlateTexture,
      // Matte stock. A little sheen, nowhere near a photographic gloss — the
      // brief rules out the plastic look explicitly.
      roughness: 0.82,
      metalness: 0,
    })
    const roomFace = new THREE.MeshBasicMaterial({
      map: heroPlateTexture,
      toneMapped: false,
      transparent: true,
      depthWrite: false,
    })

    const edge = new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: 0.95, metalness: 0 })

    // `scene.environment` is the room's evening SKY (`SceneEnvironment.jsx`),
    // and it is a property of the scene, so it goes on lighting this set even
    // with the room hidden. Left alone it put a cool blue-grey wash over a
    // table that is supposed to be lit by one warm lamp indoors — and, worse,
    // over the print at the moment it is pretending to be the room, which was
    // the whole of the colour shift across the cut. Kept as a whisper of
    // ambient for the furniture, and denied to the print entirely until it has
    // stopped being the room.
    for (const material of [top, frame, floor, edge, paper]) material.envMapIntensity = ENV_AMBIENT
    // Box face order is +X, -X, +Y, -Y, +Z, -Z: the picture goes on +Y, which
    // is the sheet's face, and the paper's own cut edge on the other five.
    const print6 = [edge, edge, paper, edge, edge, edge]
    return { top, frame, floor, paper, roomFace, edge, print6 }
  }, [wood])

  const printGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  /**
   * The key light's aim.
   *
   * A `SpotLight`'s target is a free Object3D sitting at the world origin
   * unless it is given a parent — which, for a set that is placed and rotated
   * as a whole, means the light would aim at the middle of the ROOM rather
   * than at the table. Parenting it here makes the aim part of the set.
   */
  const keyTarget = useMemo(() => new THREE.Object3D(), [])

  // The legs, as one geometry each — four boxes standing under the slab.
  const legPositions = useMemo(() => {
    const x = TABLE.width / 2 - TABLE.legInset - TABLE.legThickness / 2
    const z = TABLE.depth / 2 - TABLE.legInset - TABLE.legThickness / 2
    return [
      [-x, z],
      [x, z],
      [-x, -z],
      [x, -z],
    ]
  }, [])

  useFrame(() => {
    const group = selfRef.current
    if (!group) return

    // The set's placement and the print's size are solved before the move
    // starts and then held (`impactStage.js`); this only copies them across
    // when they actually change, so nothing is written per frame.
    if (revision.current !== stage.revision) {
      revision.current = stage.revision
      group.position.copy(stage.position)
      group.quaternion.copy(stage.quaternion)
      if (printRef.current) printRef.current.scale.set(stage.printWidth, PRINT_THICKNESS, stage.printHeight)
      if (roomFaceRef.current) roomFaceRef.current.scale.set(stage.printWidth, stage.printHeight, 1)
    }

    // `stage.travelled` is written by the pose sampler, which has already run
    // this frame (the camera rig owns an earlier priority than this).
    const lit = THREE.MathUtils.smoothstep(stage.travelled, 0, CROSSOVER_END)
    materials.roomFace.opacity = 1 - lit
    if (roomFaceRef.current) roomFaceRef.current.visible = lit < 1
    if (keyRef.current) keyRef.current.intensity = lit * KEY_INTENSITY
    if (fillRef.current) fillRef.current.intensity = lit * FILL_INTENSITY
    if (bounceRef.current) bounceRef.current.intensity = lit * BOUNCE_INTENSITY
  })

  return (
    <group ref={attach} visible={false}>
      {/* --- the table ------------------------------------------------ */}
      {/* Everything is positioned relative to the PRINT, which is the stage's
          origin, so the table is offset by where the print sits on it. */}
      <group position={[-ZONES.hero.x, 0, -ZONES.hero.z]}>
        <mesh position={[0, -TABLE.thickness / 2, 0]} castShadow receiveShadow material={materials.top}>
          <boxGeometry args={[TABLE.width, TABLE.thickness, TABLE.depth]} />
        </mesh>
        {legPositions.map(([x, z]) => (
          <mesh
            key={`${x},${z}`}
            position={[x, -TABLE.thickness - (TABLE.height - TABLE.thickness) / 2, z]}
            castShadow
            material={materials.frame}
          >
            <boxGeometry args={[TABLE.legThickness, TABLE.height - TABLE.thickness, TABLE.legThickness]} />
          </mesh>
        ))}
        {/* An apron rail under the top's long edges — what stops a slab on
            four sticks reading as a folding table. */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[0, -TABLE.thickness - 0.055, side * (TABLE.depth / 2 - TABLE.legInset)]}
            castShadow
            material={materials.frame}
          >
            <boxGeometry args={[TABLE.width - TABLE.legInset * 2, 0.085, 0.03]} />
          </mesh>
        ))}

        {/* The floor the table stands on. Large, so its own edge is never in
            shot; almost black, so what the eye reads is the light on it near
            the table and darkness past that. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -TABLE.height, 0]} receiveShadow material={materials.floor}>
          <planeGeometry args={[26, 26]} />
        </mesh>
      </group>

      {/* --- the print ------------------------------------------------ */}
      {/* A unit box scaled to the sheet: the picture is on the top face, and
          the cut edges of the stock are on the other five. */}
      <mesh
        ref={printRef}
        position={[0, PRINT_THICKNESS / 2, 0]}
        castShadow
        receiveShadow
        geometry={printGeometry}
        material={materials.print6}
      />
      {/* The unlit copy, a hair proud of the sheet's face so it can never
          z-fight with it, and written only to colour — never to depth — so it
          cannot shadow or occlude the paper it is dissolving into. */}
      <mesh
        ref={roomFaceRef}
        position={[0, PRINT_THICKNESS + 0.00002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.roomFace}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>

      {/* --- light ---------------------------------------------------- */}
      {/* The same sun, later in the day and indoors: the room's own warm
          colour, thrown from high and over the visitor's left shoulder, which
          is the direction the hero's light comes from. One key doing nearly
          all the work, a little ambient so the shadow side is not a hole, and
          a cool edge from the far corner so the far lip of the slab separates
          from the dark behind it.

          Aimed at the TABLE's centre rather than the print's: the print sits
          off to one side, and lighting the set around it is what leaves the
          two empty zones lit well enough to read as reserved space and dim
          enough to still be waiting for something. */}
      <primitive object={keyTarget} position={[-ZONES.hero.x, 0, -ZONES.hero.z]} />
      <spotLight
        ref={keyRef}
        target={keyTarget}
        position={[-2.15, 3.15, 1.45]}
        angle={0.96}
        penumbra={0.9}
        decay={1.55}
        distance={16}
        color={lightingParams.sun.color}
        intensity={0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.01}
        shadow-camera-near={0.6}
        shadow-camera-far={14}
      />
      {/* Enough to keep the shadow side off pure black, and no more — the
          brief wants darker regions left available for what lands there. */}
      <hemisphereLight ref={fillRef} args={[0x4a3a28, 0x0b0908, 0]} intensity={0} />
      {/* The cool counter, kept well under the key: at the level it was first
          tried it turned an aged timber table blue. */}
      <pointLight
        ref={bounceRef}
        position={[2.4, 1.05, -1.5]}
        color={0x8fa3bc}
        distance={6.5}
        decay={1.7}
        intensity={0}
      />
    </group>
  )
}

const ENV_AMBIENT = 0.14
const KEY_INTENSITY = 34
const FILL_INTENSITY = 1.05
const BOUNCE_INTENSITY = 0.95
