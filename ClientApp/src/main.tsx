import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Sin `!`: si el nodo raiz no existe queremos un mensaje claro, no un
// TypeError a mitad del render (docs/harness_DEV_frontend.md §2).
const raiz = document.getElementById('root')
if (raiz === null) {
  throw new Error('No se encontro el elemento #root en index.html.')
}

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
