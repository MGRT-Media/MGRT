import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { applyShadowUpdates } from '../lighting/shadowUpdates.js'
import { contentValue } from '../timeline/contentProgress.js'
import { stageLightLevel } from './stageSampling.js'
import { LIGHTS } from './studioLayout.js'
import { reflective } from './studioMaterials.js'

/**
 * One sampler per light, built once. `levels` is filled each frame and is what
 * everything that follows the lighting reads: the lights themselves, the
 * reflections on polished surfaces, and the dust (`StudioDust.jsx`).
 */
const LEVEL_AT = {
  ambient: stageLightLevel('ambient'),
  lettering: stageLightLevel('lettering'),
  tableKey: stageLightLevel('tableKey'),
  fill: stageLightLevel('fill'),
}

export const lightLevels = { ambient: 0, lettering: 0, tableKey: 0, fill: 0 }

function createSpot({ position, target, color, angleDegrees, penumbra, shadowMapSize }) {
  // Starts dark; the first frame sets its level. Decay 2 is physical falloff.
  const spot = new THREE.SpotLight(color, 0, 0, THREE.MathUtils.degToRad(angleDegrees), penumbra, 2)
  spot.position.fromArray(position)
  spot.target.position.fromArray(target)
  if (shadowMapSize) {
    spot.castShadow = true
    spot.shadow.mapSize.setScalar(shadowMapSize)
    spot.shadow.camera.near = 0.4
    spot.shadow.camera.far = 9
    spot.shadow.bias = -0.0004
    spot.shadow.normalBias = 0.012
  }
  return spot
}

/**
 * The studio's lights, each held at the level its stage asks for.
 *
 * The fixtures themselves never change: every light exists from the first
 * frame, at intensity zero if its stage has not come yet. Bringing one up is
 * therefore only a change of a number — no light is added to the scene, so no
 * material recompiles when a stage begins.
 *
 * Levels are read through `contentValue`, on the camera's own progress, so the
 * light arrives with the move that reveals it.
 *
 * Both spots cast shadows. Nothing in the room moves, so each map is drawn
 * once and held (`shadowUpdates.js`); the second map costs memory, not frames.
 */
export default function StudioLightingRig() {
  const { ambient, lettering, tableKey, fill } = useMemo(() => {
    const ambientLight = new THREE.HemisphereLight(LIGHTS.ambient.skyColor, LIGHTS.ambient.groundColor, 0)
    const fillLight = new THREE.DirectionalLight(LIGHTS.fill.color, 0)
    fillLight.position.fromArray(LIGHTS.fill.position)
    fillLight.target.position.fromArray(LIGHTS.fill.target)
    return {
      ambient: ambientLight,
      lettering: createSpot(LIGHTS.lettering),
      tableKey: createSpot(LIGHTS.tableKey),
      fill: fillLight,
    }
  }, [])

  useEffect(
    () => () => {
      ambient.dispose()
      lettering.dispose()
      tableKey.dispose()
      fill.dispose()
    },
    [ambient, lettering, tableKey, fill],
  )

  useFrame(({ gl }) => {
    applyShadowUpdates(gl)
    lightLevels.ambient = contentValue(LEVEL_AT.ambient)
    lightLevels.lettering = contentValue(LEVEL_AT.lettering)
    lightLevels.tableKey = contentValue(LEVEL_AT.tableKey)
    lightLevels.fill = contentValue(LEVEL_AT.fill)

    ambient.intensity = LIGHTS.ambient.intensity * lightLevels.ambient
    lettering.intensity = LIGHTS.lettering.intensity * lightLevels.lettering
    tableKey.intensity = LIGHTS.tableKey.intensity * lightLevels.tableKey
    fill.intensity = LIGHTS.fill.intensity * lightLevels.fill

    // A reflection is light: it rises and falls with the light it belongs to.
    for (const { material, strength, follows } of reflective) {
      material.envMapIntensity = strength * lightLevels[follows]
    }
  })

  return (
    <>
      <primitive object={ambient} />
      <primitive object={lettering} />
      <primitive object={lettering.target} />
      <primitive object={tableKey} />
      <primitive object={tableKey.target} />
      <primitive object={fill} />
      <primitive object={fill.target} />
    </>
  )
}
