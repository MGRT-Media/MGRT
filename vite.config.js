import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { extname, join, posix, relative, sep } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Content-fingerprints the static assets under `public/`.
 *
 * Vite hashes what it bundles, but `public/` is copied verbatim — so the HDRI,
 * the stone maps, the GLBs and the two videos shipped at stable paths. On
 * Vercel that means they can never be cached `immutable`, because a future
 * deploy could change a file behind a URL a browser had been told to keep
 * forever. The result was the opposite extreme: every one of them revalidated
 * on every repeat visit.
 *
 * This closes that by making the URL a function of the bytes. `albedo.webp`
 * ships as `albedo.9f2c1a04.webp`, so changed content always means a changed
 * URL and unchanged content always means the same URL — which is exactly the
 * precondition `immutable` needs, and also means an unchanged asset stays in
 * cache across deploys instead of being re-fetched.
 *
 * Hashing rather than a hand-maintained version constant: a number someone has
 * to remember to bump is a stale-asset bug waiting to happen, and the content
 * is already the authoritative version identifier.
 *
 * The mapping reaches the app through a virtual module rather than by
 * rewriting source strings, because several of these URLs are BUILT at runtime
 * (`${SCANNED_BASE}/${set}/${file}`) and no textual rewrite can see them. One
 * lookup — `assetUrl()` — sits behind the existing registries instead.
 *
 * In dev the manifest is empty and every path passes through untouched, so the
 * files are served from `public/` under their real names.
 */
const FINGERPRINTED_DIRS = ['textures', 'models', 'environment', 'media']
const ASSET_MANIFEST_ID = 'virtual:asset-manifest'
const RESOLVED_ASSET_MANIFEST_ID = '\0' + ASSET_MANIFEST_ID

function eachFile(dir, visit) {
  for (const entry of readdirSync(dir)) {
    // Dotfiles are skipped: they are never referenced, `.DS_Store` has no
    // extension to insert a hash before, and `stripDsStore` removes them anyway.
    if (entry.startsWith('.')) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) eachFile(path, visit)
    else visit(path)
  }
}

function fingerprintPublicAssets() {
  let manifest = {}
  let fingerprinting = false

  return {
    name: 'fingerprint-public-assets',
    config(_config, { command }) {
      fingerprinting = command === 'build'
    },
    buildStart() {
      manifest = {}
      if (!fingerprinting) return
      for (const dir of FINGERPRINTED_DIRS) {
        const root = join('public', dir)
        if (!existsSync(root)) continue
        eachFile(root, (path) => {
          const hash = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 8)
          const url = '/' + relative('public', path).split(sep).join(posix.sep)
          const ext = extname(url)
          manifest[url] = `${url.slice(0, url.length - ext.length)}.${hash}${ext}`
        })
      }
    },
    resolveId(id) {
      if (id === ASSET_MANIFEST_ID) return RESOLVED_ASSET_MANIFEST_ID
      return null
    },
    load(id) {
      if (id === RESOLVED_ASSET_MANIFEST_ID) return `export default ${JSON.stringify(manifest)}`
      return null
    },
    closeBundle() {
      if (!fingerprinting) return
      // The public-directory copy is not part of the Rollup graph, so the files
      // are renamed in place once it has happened.
      for (const [from, to] of Object.entries(manifest)) {
        const source = join('dist', from)
        if (existsSync(source)) renameSync(source, join('dist', to))
      }
    },
  }
}

/**
 * Strips macOS `.DS_Store` files out of the build.
 *
 * Vite copies `publicDir` verbatim, and Finder leaves a `.DS_Store` in any
 * directory it has been asked to display — so `public/textures`,
 * `public/models` and friends were shipping one each. They are already
 * gitignored; this is about the deployed output, where they are dead bytes
 * that also leak local directory metadata.
 *
 * `closeBundle` rather than a copy filter, because the public-directory copy is
 * not part of the Rollup graph and has no hook to intercept.
 */
function stripDsStore() {
  return {
    name: 'strip-ds-store',
    closeBundle() {
      const walk = (dir) => {
        for (const entry of readdirSync(dir)) {
          const path = join(dir, entry)
          if (statSync(path).isDirectory()) walk(path)
          else if (entry === '.DS_Store') rmSync(path)
        }
      }
      walk('dist')
    },
  }
}

export default defineConfig({
  plugins: [react(), fingerprintPublicAssets(), stripDsStore()],
  build: {
    rollupOptions: {
      output: {
        /**
         * Three.js is the bulk of the bundle and it never changes between
         * deploys; the app code changes on every one. Splitting them means a
         * returning visitor re-downloads only what actually moved instead of
         * the whole megabyte, and the two can be fetched in parallel on a
         * first visit.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/three/')) return 'three'
          // Matched precisely. A looser '/react' also catches
          // `@react-three/fiber`, which imports three — that put a
          // three-dependent module in the react chunk and produced a
          // vendor -> react -> vendor cycle at build time.
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react'
          }
          if (id.includes('/gsap/')) return 'gsap'
          return 'vendor'
        },
      },
    },
    // The scene is heavy enough that the default 500KB warning fires on chunks
    // that are legitimately that size; raised so it flags real regressions
    // rather than crying wolf on every build.
    chunkSizeWarningLimit: 900,
  },
})
