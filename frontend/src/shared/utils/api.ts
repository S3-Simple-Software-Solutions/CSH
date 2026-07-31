// Unico lugar del frontend que llama a fetch. Traduce el contrato HTTP del
// backend (docs/harness_DEV_backend.md §3) a una discriminated union, para que
// el compilador obligue a manejar el error antes de tocar el valor.

export type ApiResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      status: number
      title: string
      detail: string
      errors?: Record<string, string[]>
    }

/** Forma de RFC 9457 Problem Details, tal como la emite ASP.NET Core. */
interface ProblemDetails {
  title?: string
  detail?: string
  status?: number
  errors?: Record<string, string[]>
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(path, {
      // Las cookies de sesion viajan en cada request (auth con cookie, no JWT).
      credentials: 'include',
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
  } catch {
    // El servidor no respondio: sin red, caido, o CORS.
    return {
      ok: false,
      status: 0,
      title: 'Sin conexion',
      detail: 'No se pudo contactar al servidor. Revisa tu conexion.',
    }
  }

  if (res.status === 204) return { ok: true, value: undefined as T }

  if (res.ok) return { ok: true, value: (await res.json()) as T }

  const problem = (await res.json().catch(() => null)) as ProblemDetails | null
  return {
    ok: false,
    status: res.status,
    title: problem?.title ?? 'Error del servidor',
    detail: problem?.detail ?? 'No se pudo completar la operacion.',
    errors: problem?.errors,
  }
}
