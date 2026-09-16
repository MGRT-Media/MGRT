import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { environmentSource, loadSkyTexture, registerSkyUpgrade, resolvedSkyTexture, SKY_ROTATION_Y } from './skyEnvironment.js'

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

/**
 * The HDRI is a real photograph of a sky, and it is a good deal brighter than
 * the generated room it replaces — mean luminance 0.78 across the sphere,
 * measured off the file. Carried at the same 0.38 the `RoomEnvironment` used
 * and the room lifts noticeably and flattens, which is the failure the brief
 * names. This is the correction for the source being brighter, not a change
 * of intent: the analytic sun stays several times larger than the environment
 * term, so shape still comes from direction.
 */
const HDRI_ENVIRONMENT_INTENSITY = 0.40

/**
 * PMREM prefilters an environment into the roughness-indexed mip chain a
 * standard material samples. Without it a map cannot be used as an environment
 * at all — roughness would have nothing to blur toward.
 *
 * ONE generator, kept for as long as the scene is mounted, because this room
 * prefilters twice: once from the boot sky and once from the original that
 * replaces it. A generator owns a set of internal materials — the equirect
 * projection and a blur material per mip level — and disposing it releases
 * their compiled programs, so a second generator had to link all fifteen of
 * them again. Measured: sixteen program links after the reveal against none
 * when the generator is retained, spread across the frames right after the
 * sky upgrade, which is exactly where a hitch is least acceptable.
 */
function usePrefilter(gl) {
  const generator = useMemo(() => new THREE.PMREMGenerator(gl), [gl])
  useEffect(() => () => generator.dispose(), [generator])
  // The render TARGET, not just its texture: the sky upgrade re-renders the
  // environment into this same target so that `scene.environment` never
  // changes identity. See `environmentSource`.
  return useMemo(() => (build) => build(generator), [generator])
}

/**
 * Prefilters the sky, at the size the original will need.
 *
 * The enlarged copy exists only for the length of this call — PMREM reads it
 * once into its cube, and holding 4MB of upsampled sky afterwards would buy
 * nothing.
 */
function prefilterSky(prefilter, texture) {
  const source = environmentSource(texture)
  const target = prefilter((generator) => generator.fromEquirectangular(source))
  source.dispose()
  return target
}

export default function SceneEnvironment() {
  const { gl, scene } = useThree()
  const prefilter = usePrefilter(gl)

  /**
   * The HDRI, prefiltered at mount — but only when it is ALREADY decoded and
   * resident, which the loading gate's preflight makes the normal case.
   *
   * This is the whole optimisation: when this is non-null the generated
   * stand-in below is never built at all.
   */
  const hdri = useMemo(() => {
    const texture = resolvedSkyTexture()
    if (!texture) return null
    return prefilterSky(prefilter, texture)
  }, [prefilter])

  const [sky, setSky] = useState(null)

  /** The environment's render target, so the upgrade can render into it. */
  const hdriRef = useRef(null)
  hdriRef.current = hdri

  /**
   * The stand-in environment, generated in code so it costs no download.
   *
   * It exists to light the room while the HDRI is still on the wire, and it is
   * not a placeholder in the sense of being wrong — it is the environment this
   * scene shipped with, and if the HDRI never arrives the room stays exactly as
   * it was rather than losing its environment term entirely.
   *
   * What changed is when it is needed. The gate now holds the canvas out of
   * sight until the HDRI has landed, so on a normal load nothing ever sees this
   * and generating it was ~27ms spent on a texture discarded moments later.
   * Skipped when `hdri` is already in hand; still built, exactly as before,
   * whenever the HDRI is genuinely late or fails.
   */
  const generated = useMemo(() => {
    if (hdri) return null
    return prefilter((generator) => generator.fromScene(new RoomEnvironment(), 0.04))
  }, [prefilter, hdri])

  useEffect(() => {
    // Already resident and prefiltered above; nothing to wait for.
    if (hdri) return undefined
    let cancelled = false
    loadSkyTexture()
      .then((texture) => {
        if (cancelled) return
        // The same prefilter, from the photograph instead of the generated
        // box. The equirect source itself stays resident because `SunsetSky`
        // is drawing with it; this cube is the only extra allocation.
        setSky(prefilterSky(prefilter, texture))
      })
      .catch(() => {
        // Keep the generated environment. A missing sky must not unlight the room.
      })
    return () => {
      cancelled = true
    }
  }, [prefilter, hdri])

  /**
   * The original sky, prefiltered and swapped in without a frame of
   * disagreement with the dome — see `upgradeSky`.
   *
   * The prefilter is the expensive half (measured at 17ms for the original
   * against 6.5ms for the boot image) and it happens in `prepare`, before
   * anything is installed. `commit` then assigns the finished cube directly
   * rather than through state: React would apply it a render later, which is
   * the one thing this swap cannot afford — the dome and the reflections have
   * to change on the same frame.
   */
  const upgradedRef = useRef(null)
  useEffect(
    () =>
      registerSkyUpgrade((texture) => {
        // The normal case: the boot sky's environment is already prefiltered at
        // the original's size, so this renders over its contents and every
        // material goes on sampling the same texture it always has — nothing
        // is reassigned, nothing recompiles, and the room's reflections simply
        // become the real sky's on the next frame.
        const target = hdriRef.current
        if (target) {
          prefilter((generator) => generator.fromEquirectangular(texture, target))
          return null
        }
        // The fallback: the boot sky never arrived and the room is lit by the
        // generated stand-in, so there is no target to render into and the
        // environment has to be replaced outright.
        const next = prefilterSky(prefilter, texture)
        return () => {
          const previous = scene.environment
          upgradedRef.current = next
          scene.environment = next.texture
          requestAnimationFrame(() => previous?.dispose())
        }
      }),
    [prefilter, scene],
  )
  useEffect(() => () => upgradedRef.current?.dispose(), [])

  useEffect(() => {
    // Unchanged values, unchanged precedence: a photographic environment
    // whichever way it arrived, otherwise the generated one. The upgraded cube
    // wins when it exists, so a re-run of this effect cannot undo the swap.
    const photographic = upgradedRef.current ?? hdri ?? sky
    scene.environment = (photographic ?? generated)?.texture ?? null
    scene.environmentIntensity = photographic ? HDRI_ENVIRONMENT_INTENSITY : ENVIRONMENT_INTENSITY
    // Reflections have to agree with the sky the room can actually see through
    // the court — see `SKY_ROTATION_Y`.
    scene.environmentRotation = new THREE.Euler(0, photographic ? SKY_ROTATION_Y : 0, 0)
    return () => {
      scene.environment = null
    }
  }, [scene, generated, sky, hdri])

  useEffect(() => () => generated?.dispose(), [generated])
  useEffect(() => () => sky?.dispose(), [sky])
  useEffect(() => () => hdri?.dispose(), [hdri])

  return null
}
