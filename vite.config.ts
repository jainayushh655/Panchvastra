import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const emailApiPort = env.EMAIL_API_PORT?.trim() || '8787'

  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      tsconfigPaths: true,
    },

    build: {
      rollupOptions: {
        output: {
          /**
           * Split the big third-party libraries into their own chunks.
           *
           * Two reasons, and the second is the one that matters in production:
           *
           * 1. VISIBILITY. Lumped into the app bundle there is no way to see what any
           *    library actually costs. Separated, the build output states it.
           *
           * 2. CACHING. Application code changes on every deploy; React and the router do
           *    not. In one chunk, shipping a copy tweak invalidates the whole download for
           *    every returning visitor. Split, they re-fetch only the part that changed.
           *
           * Vendor chunks are keyed by library rather than one big `vendor`, so a router
           * upgrade does not invalidate React for everyone.
           */
          // No type annotation on `id`: the root ESLint config parses this file with the
          // plain JS parser, which rejects TS syntax. `vite.config.ts` is also outside
          // `tsconfig.json`'s `include`, so nothing type-checks it either way.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined

            // No `vendor-motion` rule: framer-motion is gone. It was listed as a
            // dependency but imported nowhere — the hero and route transitions are CSS
            // keyframes in `index.css`. Keeping the rule would have described a chunk
            // that can never be produced.
            if (id.includes('react-router')) return 'vendor-router'
            if (id.includes('axios')) return 'vendor-axios'
            // Matched last: 'react-dom' and 'react-router' both contain 'react'.
            if (id.includes('react-dom') || id.includes('scheduler') || id.includes('/react/')) {
              return 'vendor-react'
            }

            return undefined
          },
        },
      },
    },

    server: {
      host: true,

      proxy: {
        // Local Express API
        '/api': {
          target: `http://127.0.0.1:${emailApiPort}`,
          changeOrigin: true,
        },

        // Django Backend
        '/v1': {
          target: 'https://api.panchvastra.com',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})