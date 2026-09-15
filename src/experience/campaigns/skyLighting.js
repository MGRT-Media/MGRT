import { useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { SKY_INTENSITY, SKY_LIGHTING_URL } from './exteriorAtmosphere.js'

/** Horizon band averaged for the haze colour, in degrees of elevation. */
const HORIZON_BAND = [0, 6]

const horizonCache = new WeakMap()

/**
 * The lighting HDR and the haze colour derived from it — the sky's own average
 * radiance just above the horizon, at the intensity the dome is drawn at, so
 * the fog carries distant ground into the sky seamlessly. Cached per texture;
 * `River.jsx` reads the same value for the far water.
 */
export function useSkyLighting() {
  const hdr = useLoader(RGBELoader, SKY_LIGHTING_URL)
  const horizonColor = useMemo(() => {
    if (horizonCache.has(hdr)) return horizonCache.get(hdr)
    const { width, height, data } = hdr.image
    const read = data instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat : (v) => v
    const sum = [0, 0, 0]
    let count = 0
    for (let y = 0; y < height; y += 1) {
      const elevation = 90 - ((y + 0.5) / height) * 180
      if (elevation < HORIZON_BAND[0] || elevation > HORIZON_BAND[1]) continue
      for (let x = 0; x < width; x += 4) {
        const i = (y * width + x) * 4
        sum[0] += read(data[i])
        sum[1] += read(data[i + 1])
        sum[2] += read(data[i + 2])
        count += 1
      }
    }
    const color = new THREE.Color().setRGB(
      (sum[0] / count) * SKY_INTENSITY,
      (sum[1] / count) * SKY_INTENSITY,
      (sum[2] / count) * SKY_INTENSITY,
      THREE.LinearSRGBColorSpace,
    )
    horizonCache.set(hdr, color)
    return color
  }, [hdr])
  return { hdr, horizonColor }
}

