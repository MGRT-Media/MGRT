import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { applyShadowUpdates } from '../lighting/shadowUpdates.js'
import { contentValue } from '../timeline/contentProgress.js'
import { stageLightLevel } from './stageSampling.js'
import { LIGHTS } from './studioLayout.js'

const ambientLevel = stageLightLevel('ambient')
const letteringLevel = stageLightLevel('lettering')
const tableKeyLevel = stageLightLevel('tableKey')

function createSpot({ position, target, color, angleDegrees, penumbra }) {
  // Starts dark; the first frame sets its level. Decay 2 is physical falloff.
  const spot = new THREE.SpotLight(color, 0, 0, THREE.MathUtils.degToRad(angleDegrees), penumbra, 2)
  spot.position.fromArray(position)
  spot.target.position.fromArray(target)
  return spot
}

/**
 * The studio's three lights, each held at the level its stage asks for.
 *
 * The fixtures themselves never change: every light exists from the first
 * frame, at intensity zero if its stage has not come yet. Bringing one up is
 * therefore only a change of a number — no light is added to the scene, so no
 * material recompiles when a stage begins.
 *
 * Levels are read through `contentValue`, on the camera's own progress, so the
 * light arrives with the move that reveals it.
 */
export default function StudioLightingRig() {
  const { ambient, lettering, tableKey } = useMemo(() => {
    const ambientLight = new THREE.HemisphereLight(LIGHTS.ambient.skyColor, LIGHTS.ambient.groundColor, 0)
    const letteringSpot = createSpot(LIGHTS.lettering)
    const tableKeySpot = createSpot(LIGHTS.tableKey)
    // The one shadow caster. Nothing in the room moves, so its map is drawn
    // once and held (`shadowUpdates.js`).
    tableKeySpot.castShadow = true
    tableKeySpot.shadow.mapSize.setScalar(LIGHTS.tableKey.shadowMapSize)
    tableKeySpot.shadow.bias = -0.0005
    return { ambient: ambientLight, lettering: letteringSpot, tableKey: tableKeySpot }
  }, [])

  useEffect(
    () => () => {
      ambient.dispose()
      lettering.dispose()
      tableKey.dispose()
    },
    [ambient, lettering, tableKey],
  )

  useFrame(({ gl }) => {
    applyShadowUpdates(gl)
    ambient.intensity = LIGHTS.ambient.intensity * contentValue(ambientLevel)
    lettering.intensity = LIGHTS.lettering.intensity * contentValue(letteringLevel)
    tableKey.intensity = LIGHTS.tableKey.intensity * contentValue(tableKeyLevel)
  })

  return (
    <>
      <primitive object={ambient} />
      <primitive object={lettering} />
      <primitive object={lettering.target} />
      <primitive object={tableKey} />
      <primitive object={tableKey.target} />
    </>
  )
}
