import { describe, expect, test, vi, afterEach } from 'vitest'
import { apiFetch } from './api'

function responderCon(body: unknown, init: ResponseInit) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), init)),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('apiFetch', () => {
  test('un 200 devuelve ok con el valor tipado', async () => {
    responderCon({ estado: 'ok' }, { status: 200 })

    const res = await apiFetch<{ estado: string }>('/healthz')

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.estado).toBe('ok')
  })

  test('un 204 devuelve ok sin cuerpo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    const res = await apiFetch<void>('/api/algo', { method: 'DELETE' })

    expect(res.ok).toBe(true)
  })

  test('un Problem Details se traduce a la rama de error', async () => {
    responderCon(
      { title: 'Evento agotado', detail: 'No quedan entradas disponibles.' },
      { status: 409 },
    )

    const res = await apiFetch('/api/entradas')

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.status).toBe(409)
      expect(res.title).toBe('Evento agotado')
      expect(res.detail).toBe('No quedan entradas disponibles.')
    }
  })

  test('un error sin cuerpo JSON no revienta y trae texto usable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>500</html>', { status: 500 })),
    )

    const res = await apiFetch('/api/algo')

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.detail).not.toBe('')
  })

  test('si el servidor no responde, devuelve error de conexion en vez de lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const res = await apiFetch('/api/algo')

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(0)
  })
})
