import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      // Netlify functions (public demo) — run `npx netlify dev` alongside, default port 8888.
      '/.netlify/functions': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
