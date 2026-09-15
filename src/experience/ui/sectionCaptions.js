import * as THREE from 'three'
import { lensIgniteAt } from '../film/CinemaCamera.jsx'
import { DIGITAL_IGNITE_RISE, MONITOR_SNAP_T } from '../timeline/filmActBeats.js'

/**
 * The editorial copy for each section, rendered by `SectionCaption.jsx`.
 *
 * Content lives here, presentation in the component and `global.css`. Each
 * entry also says when its section is on screen: `presenceAt(progress)` is a
 * 0-1 curve over camera progress that peaks where that section's camera
 * settles. The component shows the copy once it is nearly at its peak.
 */

/**
 * Digital's presence: rising onto the monitor shot exactly as the screen does
 * (`Monitor.jsx`'s ignite), and falling over the same distance as the camera
 * leaves for the hero.
 *
 * The screen itself only ever ramps up to `MONITOR_SNAP_T` and stays lit on the
 * way to the hero. The copy has to leave with the section, so it gets the
 * falling half the screen does not have.
 */
function digitalPresenceAt(progress) {
  const rise = THREE.MathUtils.smoothstep(progress, MONITOR_SNAP_T - DIGITAL_IGNITE_RISE, MONITOR_SNAP_T)
  const fall = 1 - THREE.MathUtils.smoothstep(progress, MONITOR_SNAP_T, MONITOR_SNAP_T + DIGITAL_IGNITE_RISE)
  return Math.min(rise, fall)
}

export const FILM_CAPTION = {
  id: 'film',
  label: 'Film',
  description: 'Stories made to move people.',
  services: ['Brand films', 'Commercials', 'Creative production'],
  // The lens preview's own curve — the one the preview and the fullscreen
  // button use.
  presenceAt: lensIgniteAt,
}

export const DIGITAL_CAPTION = {
  id: 'digital',
  label: 'Digital',
  description: 'Ideas brought to life in pixels, motion, and interaction.',
  services: ['Websites & e-commerce', '3D animation', 'Interactive experiences'],
  presenceAt: digitalPresenceAt,
}
