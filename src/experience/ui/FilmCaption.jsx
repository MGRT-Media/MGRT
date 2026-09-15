import { Fragment, useEffect, useState } from 'react'
import { contentValue } from '../timeline/contentProgress.js'
import { cameraProgress } from '../timeline/heroSequence.js'
import { lensIgniteAt } from '../film/CinemaCamera.jsx'
import { videoModalState } from './videoModalState.js'

/**
 * How far into Film the caption waits, on the lens preview's own curve
 * (`lensIgniteAt`) — the one the preview and the fullscreen button use. The
 * button appears at 0.5, the moment there is a picture to open; the caption
 * waits until the camera has all but settled on the lens, and leaves just as
 * early on the way out.
 *
 * Both readings must agree. `contentValue` is what the scene shows, and makes
 * forward scroll, reverse scroll and a section flight resolve the same way; but
 * during a flight it reaches Film well before the camera does, so the camera's
 * own place on the path (`cameraProgress`) holds the copy back until it lands.
 */
const CAPTION_SHOWN_AT = 0.9

const SERVICES = ['Brand films', 'Commercials', 'Creative production']

function isCaptionShown() {
  return (
    !videoModalState.open &&
    contentValue(lensIgniteAt) >= CAPTION_SHOWN_AT &&
    lensIgniteAt(cameraProgress.value) >= CAPTION_SHOWN_AT
  )
}

/**
 * The Film section's editorial caption, bottom-left over a soft local shade.
 *
 * Same pattern as `FullscreenButton.jsx`: the continuous value is read in a
 * rAF loop and only the rare visible flip is React state. The fade itself is a
 * CSS transition on that flip, so the copy stays up for as long as Film is
 * active rather than on any timer, and steps aside while the full-screen video
 * plays.
 */
export default function FilmCaption() {
  const [visible, setVisible] = useState(isCaptionShown)

  useEffect(() => {
    let rafId
    let lastVisible = isCaptionShown()
    const tick = () => {
      const next = isCaptionShown()
      if (next !== lastVisible) {
        lastVisible = next
        setVisible(next)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <section
      className={`film-caption${visible ? ' film-caption--visible' : ''}`}
      aria-labelledby="film-caption-title"
    >
      <h2 id="film-caption-title" className="film-caption__label">
        Film
      </h2>
      <p className="film-caption__description">Stories made to move people.</p>
      {/* Each service stays whole when the line wraps in a narrow column. */}
      <p className="film-caption__services">
        {SERVICES.map((service, index) => (
          <Fragment key={service}>
            {index > 0 && ' · '}
            <span className="film-caption__service">{service}</span>
          </Fragment>
        ))}
      </p>
    </section>
  )
}
