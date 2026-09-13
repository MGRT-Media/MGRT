import * as THREE from 'three'

/**
 * What the depth of field shares with effects composited after it.
 *
 * Airborne dust is drawn after the blur (see `DepthOfField.jsx`'s `DustPass`)
 * because a gathering blur cannot resolve a one-pixel mote: it averages it into
 * the pixels around it until nothing is left. So the dust lays out its own
 * defocus instead, and it has to agree with the room's blur exactly. These
 * uniform objects are the single source of those numbers — `DepthOfField`
 * writes them every frame and the dust material holds the same objects, so
 * there is nothing to copy and nothing to drift.
 */
export const depthOfFieldUniforms = {
  /** Focus distance, world units. */
  uFocus: { value: 5 },
  /** Blur growth per unit away from the focal plane, in frame-width fractions. */
  uAperture: { value: 0 },
  /** Largest blur radius, in frame-width fractions. */
  uMaxBlur: { value: 0 },
  /** The blur pass's own depth buffer: opaque geometry only, RGBA-packed. */
  uSceneDepth: { value: null },
  uNearClip: { value: 0.05 },
  uFarClip: { value: 100 },
  /** Drawing-buffer size in pixels. */
  uResolution: { value: new THREE.Vector2(1, 1) },
}

/**
 * Signed blur radius for a view-space depth, in frame-width fractions.
 *
 * The stock bokeh shader clamps a straight line at `maxblur`, which has a
 * corner: everything past a certain depth is identically at the ceiling, and
 * the change from "still sharpening" to "flat maximum" is a visible contour
 * across any surface that crosses it. This rises the same way near the focal
 * plane and eases onto the ceiling instead, so blur keeps changing smoothly
 * with depth all the way out.
 */
export const circleOfConfusionGLSL = /* glsl */ `
  float circleOfConfusion( const in float viewZ, const in float focus, const in float aperture, const in float maxBlur ) {
    float raw = ( focus + viewZ ) * aperture;
    if ( maxBlur <= 0.0 ) return 0.0;
    return sign( raw ) * maxBlur * ( 1.0 - exp( -abs( raw ) / maxBlur ) );
  }
`
