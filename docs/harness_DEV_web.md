# Harness DEV — Web

Extiende [`harness_DEV_cliente.md`](harness_DEV_cliente.md), que tiene el
contrato común a los dos clientes y hay que leer primero.

Acá va **solo lo que se aparta** de ese contrato por ser web.

---

## 1. Estructura

### Lo que existe hoy

```
frontend/src/
├── shared/
│   ├── components/
│   │   └── LoadingBlock.tsx
│   └── utils/
│       └── api.ts           ← apiFetch, único punto de salida HTTP
├── test/setup.ts
├── App.tsx
├── index.css                ← variables del sistema
└── main.tsx
```

`modules/` y `shared/hooks/` **todavía no existen**: los crea el primer módulo
que se implemente, con la estructura de
[`harness_DEV_cliente.md §1`](harness_DEV_cliente.md).

### El alias `@`

Está declarado **en dos lados**: `vite.config.ts` para el bundler y
`tsconfig.app.json` para el compilador. Si falta uno, el build pasa y el
typecheck falla, o al revés.

---

## 2. `apiFetch` — versión web

La web autentica con **cookie de sesión** ([`harness_DEV_backend.md §6`](harness_DEV_backend.md)),
así que no maneja tokens: la cookie viaja sola.

Este es el archivo real, `frontend/src/shared/utils/api.ts`:

```ts
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(path, {
      credentials: 'include',
      ...init,
      // `headers` va DESPUES del spread de init, no antes: al reves, un init con
      // headers propios pisaria el objeto entero y se perderia el content-type.
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
  } catch {
    // El servidor no respondio: sin red, caido, o CORS. Sin este catch, cada
    // pantalla necesitaria su propio try/catch.
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
```

Dos detalles que parecen menores y no lo son: **el orden de `headers` respecto
al spread**, y **el `catch` alrededor del `fetch`**. Son los que se rompen al
reescribir esta función de memoria.

---

## 3. Estilos

- **CSS variables del sistema** — nunca hardcodear colores (`--bg`, `--gold`,
  `--muted`, `--surface`, etc.).
- Dark mode por defecto; light mode via `html[data-theme='light']`.
- Sin Tailwind, sin styled-components, sin CSS-in-JS.
- Fuentes definidas hoy en `frontend/src/index.css`: `--font-display` y
  `--font-body`. La aplicación anterior tenía además `--font-label` (Oswald) y
  `--font-accent` (Playfair Display); si se necesitan, se agregan ahí primero.
- `@media (prefers-reduced-motion: reduce)` en cualquier cosa que anime.

---

## 4. Pendiente de crear

Estas piezas existían en la aplicación anterior y se van a necesitar de nuevo,
pero **todavía no están** en `frontend/`. Quien las cree primero las agrega acá
y en `shared/`:

| Pieza | Para qué |
|---|---|
| `useEscClose(onClose)` | Cerrar modales y paneles con Escape |
| `useConfirm()` | Confirmar acciones destructivas del admin |
| `lucide-react` | Íconos — es la librería elegida, falta instalarla |

Mientras no existan, no las cites en código: el import no resuelve.
