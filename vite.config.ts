import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  /** Same port as `server/index.ts` (dotenv there); Vite does not load `.env` into `process.env` for this file unless we load it. */
  const env = loadEnv(mode, process.cwd(), '')
  const emailApiPort = env.EMAIL_API_PORT?.trim() || '8787'

  return {
    plugins: [react(), tailwindcss()],
    /** Resolves `@/` the same way as `compilerOptions.paths` in tsconfig.json (Vite 8+) */
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      host: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${emailApiPort}`,
          changeOrigin: true,
        },

      '/v1': {
      target: 'https://web-production-7de49.up.railway.app',
      changeOrigin: true,
      secure: true,
        },  
      },
    },
  }
})
