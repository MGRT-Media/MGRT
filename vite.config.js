import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /**
         * Three.js is the bulk of the bundle and it never changes between
         * deploys; the app code changes on every one. Splitting them means a
         * returning visitor re-downloads only what actually moved instead of
         * the whole megabyte, and the two can be fetched in parallel on a
         * first visit.
         *
         * Act 3 is not listed here — it is already its own chunk by virtue of
         * being dynamically imported in `CampaignsGate`, and naming it would
         * force it back into the static graph.
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
