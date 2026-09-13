import manifest from 'virtual:asset-manifest'

/**
 * Resolves a `public/` path to its content-fingerprinted URL.
 *
 * Production builds ship these files under a hash of their own bytes
 * (`albedo.webp` -> `albedo.412614ee.webp`) so that Vercel can serve them
 * `immutable` with no risk of a changed file staying stale behind a cached
 * URL — see `fingerprintPublicAssets` in `vite.config.js`.
 *
 * In development the manifest is empty and every path is returned unchanged,
 * so the dev server keeps serving the real filenames out of `public/`.
 *
 * This is deliberately the ONLY place that knows fingerprinted names exist.
 * Call it from the asset registries — `MODEL_URLS`, `SKY_HDRI_URL`,
 * `scannedStoneUrls`, the media constants — never from a component, so scene
 * code goes on asking for the same stable paths it always has.
 *
 * Unknown paths pass through rather than throwing: a path outside the
 * fingerprinted directories is a legitimate caller, and a typo should surface
 * as a visible 404 rather than take the scene down at module load.
 */
export function assetUrl(path) {
  return manifest[path] ?? path
}
