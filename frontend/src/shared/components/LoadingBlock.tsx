// Estado de carga compartido. El harness pide que ninguna pantalla que dependa
// de una llamada quede en blanco mientras carga.

interface LoadingBlockProps {
  label?: string
}

export function LoadingBlock({ label = 'Cargando…' }: LoadingBlockProps) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
