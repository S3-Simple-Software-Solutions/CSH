import { useEffect, useState } from 'react'
import { apiFetch } from '@/shared/utils/api'
import { LoadingBlock } from '@/shared/components/LoadingBlock'

interface Salud {
  estado: string
}

// Pantalla minima del esqueleto: prueba el camino completo browser -> Vite ->
// CSH.Host y ejercita los tres estados que el harness exige mostrar siempre
// (docs/harness_DEV_frontend.md §4).
export default function App() {
  const [salud, setSalud] = useState<Salud | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    apiFetch<Salud>('/healthz').then((res) => {
      if (res.ok) setSalud(res.value)
      else setError(res.detail)
      setCargando(false)
    })
  }, [])

  return (
    <main className="app">
      <h1>Club Sport Herediano</h1>
      <p className="muted">Esqueleto de la solucion. Todavia no hay modulos.</p>

      <section>
        <h2>Estado del backend</h2>
        {cargando && <LoadingBlock />}
        {!cargando && error !== null && <p className="error">{error}</p>}
        {!cargando && salud !== null && (
          <p className="ok">
            La API responde: <strong>{salud.estado}</strong>
          </p>
        )}
      </section>
    </main>
  )
}
