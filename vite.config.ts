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

    server: {
      host: true,

      proxy: {
        // Local Express API
        '/api': {
          target: `http://127.0.0.1:${emailApiPort}`,
          changeOrigin: true,
        },

        // Local Django Backend
        '/v1': {
          target: 'https://api.panchvastra.com',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})