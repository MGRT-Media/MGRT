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
/**
 * 0.12 -> 0.38.
 *
 * The old value's reasoning was sound for the room it was written for: "this
 * is a nocturnal room, and IBL is here to give the stone something to
 * reflect, not to raise the exposure." That room no longer exists. There is
 * now a 10 x 11 hole in the roof, and a real interior open to the sky gathers
 * a great deal of light off its own surfaces from every direction — that is
 * precisely what an environment term models, and at 0.12 the room was
 * pretending it had no sky.
 *
 * Still far below the 1.0 of a lit product shot, and deliberately so: this is
 * the term that lifts shadow OUT of black without flattening, but push it far
 * enough and it does flatten, which is the failure the brief names. The
 * analytic sun remains several times larger, so shape still comes from
 * direction rather than from ambient.
 */
const ENVIRONMENT_INTENSITY = 0.38

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
