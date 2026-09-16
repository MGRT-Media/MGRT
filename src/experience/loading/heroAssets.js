/**
 * The files the opening frame cannot be shown without — the single list the
 * HTML's preload hints and the runtime preflight are both built from.
 *
 * `vite.config.js` reads this at build time to write `<link rel="preload">`
 * tags into `index.html`, so these requests start while the HTML is being
 * parsed instead of after the application bundle has downloaded and run
 * (measured: assets began at ~600ms on Fast 4G, against ~10ms as hints).
 * `criticalAssets.js` checks its own list against this one in development, so
 * the two cannot drift apart.
 *
 * `as` matters: it has to match how the loader will ask for the file, or the
 * browser fetches it twice. Models and the HDR are read by three's `FileLoader`
 * (fetch), the stone maps by `TextureLoader` (an `<img>` with
 * `crossOrigin="anonymous"`).
 *
 * Paths are the plain `public/` ones; the build rewrites them to their
 * fingerprinted names through the same manifest `assetUrl()` uses.
 *
 * The sky here is the 512px BOOT image, not the original: the opening is drawn
 * with it and `deferredAssets.js` replaces it with the 1K once the room is on
 * screen. Same for the props — the GLBs listed below carry 256px maps and
 * their full-resolution ones arrive later, so none of that weight is in front
 * of the reveal.
 *
 * Deliberately NOT here: the brass inlay maps (the wordmark they dress is not
 * on screen until the hero beat — see `SceneEnvironment`/`wallInscription`),
 * the chapter videos, and anything else a later beat introduces.
 */
export const HERO_PRELOADS = [
  { path: '/models/camera/movie-camera.glb', as: 'fetch' },
  { path: '/models/camera/camera-stand.glb', as: 'fetch' },
  { path: '/models/monitor/spark-computer.glb', as: 'fetch' },
  { path: '/models/pedestal/digital-stone.glb', as: 'fetch' },
  { path: '/environment/evening-road-puresky-512.hdr', as: 'fetch' },
  { path: '/textures/walls/albedo.webp', as: 'image' },
  { path: '/textures/walls/normal.webp', as: 'image' },
  { path: '/textures/walls/orm.webp', as: 'image' },
  { path: '/textures/floors/albedo.webp', as: 'image' },
  { path: '/textures/floors/normal.webp', as: 'image' },
  { path: '/textures/floors/orm.webp', as: 'image' },
  { path: '/textures/columns/albedo.webp', as: 'image' },
  { path: '/textures/columns/normal.webp', as: 'image' },
  { path: '/textures/columns/orm.webp', as: 'image' },
]
