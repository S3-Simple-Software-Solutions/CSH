import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { formatBuildTag } from './src/shared/utils/buildTag.ts'

// El puerto del backend esta fijado en
// backend/src/CSH.Host/Properties/launchSettings.json.
// Si cambia alla, tiene que cambiar aca (docs/harness_DEV.md §3).
//
// En el flujo nativo (dos terminales) el backend vive en 127.0.0.1:5080. En
// docker-compose.dev.yml el frontend corre en otro contenedor y el backend se
// llama `backend`, asi que el destino se pasa por VITE_API_TARGET. El default
// preserva el flujo nativo sin configurar nada.
const API = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:5080'

// Identificador de la revision desplegada (issue #119): `v0.3-c021d8c` en
// produccion, `dev-c021d8c` en dev. Los dos valores los pasa el deploy como
// build-args del Containerfile; en un build local no existen y el tag queda
// como `local-??`.
const BUILD_TAG = formatBuildTag({
  version: process.env.APP_VERSION,
  commitSha: process.env.COMMIT_SHA,
})

// Deja el tag en el <head> como metadato, para poder leerlo del HTML servido
// sin ejecutar la SPA ni pegarle a un endpoint.
function buildTagMeta(): Plugin {
  return {
    name: 'csh-build-tag-meta',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { name: 'app-version', content: BUILD_TAG },
          injectTo: 'head',
        },
      ]
    },
  }
}

export default defineConfig({
  plugins: [react(), buildTagMeta()],
  define: {
    __BUILD_TAG__: JSON.stringify(BUILD_TAG),
  },
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
    outDir: '../backend/src/CSH.Host/wwwroot',
    emptyOutDir: true,
  },
})
