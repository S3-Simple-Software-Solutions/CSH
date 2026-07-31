import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// El puerto del backend esta fijado en src/CSH.Host/Properties/launchSettings.json.
// Si cambia alla, tiene que cambiar aca (docs/harness_DEV.md §3).
const API = 'http://127.0.0.1:5080'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Se trabaja contra este puerto, no contra el del backend: asi el front ve
    // el mismo origen que en produccion y las cookies de sesion se comportan
    // igual que en el deploy.
    proxy: {
      '/api': API,
      '/healthz': API,
    },
  },
  build: {
    // El Host sirve la SPA compilada desde wwwroot.
    outDir: '../src/CSH.Host/wwwroot',
    emptyOutDir: true,
  },
})
