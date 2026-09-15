import { Fragment, useEffect, useState } from 'react'
import { contentValue } from '../timeline/contentProgress.js'
import { cameraProgress } from '../timeline/journeyProgress.js'
import { videoModalState } from './videoModalState.js'

/**
 * How near its peak a section's presence curve must be before the copy shows.
 * The fullscreen button appears at 0.5, the moment there is a picture to open;
 * the copy waits until the camera has all but settled, and leaves just as early
 * on the way out.
 */
const CAPTION_SHOWN_AT = 0.9

/**
 * Both readings must agree. `contentValue` is what the scene shows, and makes
 * forward scroll, reverse scroll and a section flight resolve the same way; but
 * during a flight it reaches the destination well before the camera does, so
 * the camera's own place on the path (`cameraProgress`) holds the copy back
 * until it lands.
 */
function isCaptionShown(presenceAt) {
  return (
    !videoModalState.open &&
    contentValue(presenceAt) >= CAPTION_SHOWN_AT &&
    presenceAt(cameraProgress.value) >= CAPTION_SHOWN_AT
  )
}

/**
 * A section's editorial caption, bottom-left over a soft local shade. The
 * content and the section's timing come from `sectionCaptions.js`.
 *
 * Same pattern as `FullscreenButton.jsx`: the continuous value is read in a
 * rAF loop and only the rare visible flip is React state. The fade itself is a
 * CSS transition on that flip, so the copy stays up for as long as the section
 * is active rather than on any timer, and steps aside while the full-screen
 * video plays.
 */
export default function SectionCaption({ caption }) {
  const { id, label, description, services, presenceAt } = caption
  const [visible, setVisible] = useState(() => isCaptionShown(presenceAt))

  useEffect(() => {
    let rafId
    let lastVisible = isCaptionShown(presenceAt)
    const tick = () => {
      const next = isCaptionShown(presenceAt)
      if (next !== lastVisible) {
        lastVisible = next
        setVisible(next)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [presenceAt])

  const titleId = `${id}-caption-title`

  return (
    <section
      className={`section-caption section-caption--${id}${visible ? ' section-caption--visible' : ''}`}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="section-caption__label">
        {label}
      </h2>
      <p className="section-caption__description">{description}</p>
      {/* Each service stays whole when the line wraps in a narrow column. */}
      <p className="section-caption__services">
        {services.map((service, index) => (
          <Fragment key={service}>
            {index > 0 && ' · '}
            <span className="section-caption__service">{service}</span>
          </Fragment>
        ))}
      </p>
    </section>
  )
}
