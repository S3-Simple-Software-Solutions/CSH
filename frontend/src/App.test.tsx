import { describe, expect, test, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import * as api from '@/shared/utils/api'

afterEach(() => vi.restoreAllMocks())

describe('App', () => {
  test('muestra el estado cuando la API responde', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue({ ok: true, value: { estado: 'ok' } })

    render(<App />)

    expect(await screen.findByText('ok')).toBeInTheDocument()
  })

  test('muestra el detalle del error cuando la API falla', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue({
      ok: false,
      status: 0,
      title: 'Sin conexion',
      detail: 'No se pudo contactar al servidor. Revisa tu conexion.',
    })

    render(<App />)

    expect(await screen.findByText(/no se pudo contactar/i)).toBeInTheDocument()
  })

  test('muestra la version y el commit desplegados', () => {
    vi.spyOn(api, 'apiFetch').mockReturnValue(new Promise(() => {}))

    render(<App />)

    // Vite reemplaza __BUILD_TAG__ en build time; en los tests corre sin
    // build-args, asi que solo se verifica el formato version-commit.
    expect(screen.getByText(/^[\w.-]+-([0-9a-f]{1,7}|\?\?)$/)).toBeInTheDocument()
  })

  test('muestra el estado de carga antes de que responda la API', () => {
    vi.spyOn(api, 'apiFetch').mockReturnValue(new Promise(() => {}))

    render(<App />)

    // El harness pide que ninguna pantalla quede en blanco mientras carga.
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
