import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Image-based lighting for the room's stone.
 *
 * Until this existed, `scene.environment` was null and `useTreatedMaterials`
 * additionally forced `envMapIntensity = 0` on every loaded model, so nothing
 * in the room received any environment light at all. That is a large part of
 * why the surfaces read as computed rather than photographed: a physically
 * based material derives most of its character from what the *surroundings*
 * reflect into it, and with only three analytic lights a rough stone face has
 * nothing to gather except a single diffuse term per light. Highlights fall
 * off in perfect radial gradients, shadowed faces go to flat ambient, and the
 * result looks like shaded geometry instead of a lit object.
 *
 * `RoomEnvironment` is used rather than an HDRI: it is generated in code, so
 * it costs no download, and it is a neutral box of soft area lights — which is
 * what a dark interior needs. A photographic HDRI would import its own sky,
 * sun direction and colour cast, and fight the practical the whole sequence is
 * built around.
 *
 * **The intensity is the whole design.** `ENVIRONMENT_INTENSITY` is deliberately
 * far below the 1.0 a lit product shot would use. This is a nocturnal room, and
 * IBL is here to give the stone something to reflect, not to raise the exposure
 * — at 1.0 the environment alone lights the whole space flat and every darkness
 * decision made so far is undone.
 */
const ENVIRONMENT_INTENSITY = 0.12

export default function SceneEnvironment() {
  const { gl, scene } = useThree()

  const environment = useMemo(() => {
    // PMREM prefilters the environment into the roughness-indexed mip chain a
    // standard material samples. Without it the map cannot be used as an
    // environment at all — roughness would have nothing to blur toward.
    const generator = new THREE.PMREMGenerator(gl)
    const texture = generator.fromScene(new RoomEnvironment(), 0.04).texture
    generator.dispose()
    return texture
  }, [gl])

  useEffect(() => {
    scene.environment = environment
    scene.environmentIntensity = ENVIRONMENT_INTENSITY
    return () => {
      scene.environment = null
      environment.dispose()
    }
  }, [scene, environment])

  return null
}
