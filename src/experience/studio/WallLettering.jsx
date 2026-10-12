import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LETTERING, LETTERING_CENTER, LETTERING_HEIGHT } from './studioLayout.js'

const MAP_WIDTH = 1024
const MAP_HEIGHT = Math.round(MAP_WIDTH / LETTERING.aspect)

/**
 * Sets the two lines the way the established wordmark does: each letter placed
 * individually with the line's own tracking, and the line scaled to its share
 * of the block's width.
 */
function drawWordmark(context) {
  const { fontFamily, fontWeight, lines } = LETTERING
  context.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
  context.fillStyle = '#fff'
  context.textBaseline = 'middle'

  for (const line of lines) {
    const lineWidthAt = (size) => {
      context.font = `${fontWeight} ${size}px ${fontFamily}`
      const gap = size * line.tracking
      let total = 0
      for (const letter of line.text) total += context.measureText(letter).width + gap
      return total - gap
    }

    const probe = 200
    const fontSize = (probe * MAP_WIDTH * line.fill) / lineWidthAt(probe)
    const gap = fontSize * line.tracking
    let x = (MAP_WIDTH - lineWidthAt(fontSize)) / 2
    for (const letter of line.text) {
      context.fillText(letter, x, MAP_HEIGHT * line.baseline)
      x += context.measureText(letter).width + gap
    }
  }
}

/**
 * PLACEHOLDER for the MGRT / MEDIA wall lettering: the wordmark drawn flat, at
 * its real size and position, standing just off the wall.
 *
 * It is the established setting — Cormorant Medium, same line proportions and
 * tracking — so its footprint on the wall is the one the final letters will
 * have. The physical letters (extruded, bevelled, in metal) replace this in
 * Phase 3.
 */
export default function WallLettering() {
  const { texture, paint } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = MAP_WIDTH
    canvas.height = MAP_HEIGHT
    const context = canvas.getContext('2d')
    const map = new THREE.CanvasTexture(canvas)
    map.anisotropy = 8
    return {
      texture: map,
      paint: () => {
        drawWordmark(context)
        map.needsUpdate = true
      },
    }
  }, [])

  useEffect(() => {
    paint()
    // Painted again once Cormorant is in: the first pass may have been set in
    // the fallback face, which has different letter widths.
    document.fonts.load(`${LETTERING.fontWeight} 1em ${LETTERING.fontFamily}`).then(paint, () => {})
    document.fonts.addEventListener('loadingdone', paint)
    return () => {
      document.fonts.removeEventListener('loadingdone', paint)
      texture.dispose()
    }
  }, [paint, texture])

  return (
    <mesh position={LETTERING_CENTER}>
      <planeGeometry args={[LETTERING.width, LETTERING_HEIGHT]} />
      <meshStandardMaterial color="#1b1b1b" roughness={0.6} alphaMap={texture} alphaTest={0.5} />
    </mesh>
  )
}
