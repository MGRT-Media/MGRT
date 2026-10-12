import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ZONES } from './studioLayout.js'

const LABELS = { film: 'FILM', mgrt: 'MGRT', digital: 'DIGITAL' }

// Texels per metre of tabletop.
const RESOLUTION = 320

// Just clear of the tabletop, so the two surfaces do not fight for depth.
const LIFT = 0.003

function drawGuide(label, [width, depth]) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * RESOLUTION)
  canvas.height = Math.round(depth * RESOLUTION)
  const context = canvas.getContext('2d')
  context.strokeStyle = '#fff'
  context.lineWidth = 6
  context.setLineDash([22, 16])
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16)
  context.fillStyle = '#fff'
  context.font = '600 34px system-ui, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(label, canvas.width / 2, canvas.height / 2)
  return new THREE.CanvasTexture(canvas)
}

/**
 * TEMPORARY composition guides: a dashed outline and a label on the tabletop
 * for each of the three collections' areas.
 *
 * They are here to check that each camera stage frames enough of the table for
 * what will eventually sit there. They are not a design and not table content.
 * Mounted from `StudioRoom.jsx`; remove that one line to take them out.
 */
export default function ZoneGuides() {
  const guides = useMemo(
    () => Object.entries(ZONES).map(([key, zone]) => ({ key, zone, texture: drawGuide(LABELS[key], zone.size) })),
    [],
  )

  useEffect(() => () => guides.forEach((guide) => guide.texture.dispose()), [guides])

  return guides.map(({ key, zone, texture }) => (
    <mesh
      key={key}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[zone.center[0], zone.center[1] + LIFT, zone.center[2]]}
    >
      <planeGeometry args={zone.size} />
      <meshStandardMaterial color="#e6e6e6" roughness={1} alphaMap={texture} transparent depthWrite={false} />
    </mesh>
  ))
}
