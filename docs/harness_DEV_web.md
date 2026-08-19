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

## 4. Estado global — Zustand

El estado global se mantiene **chico a propósito**. La mayoría de lo que parece
global no lo es:

| Tipo | Ejemplo | Dónde vive |
|---|---|---|
| Estado de servidor | eventos, butacas, cupos | cache de datos (TanStack Query, [cliente §4](harness_DEV_cliente.md)), **no** en el store |
| Estado global de cliente | la sesión: ¿quién soy?, ¿admin? | store de Zustand |
| Estado local | formularios, modal abierto, tab activo | `useState` en la pantalla |

Meter datos del servidor en el store global es el error clásico: duplica el
cache y obliga a invalidar a mano. Eso es trabajo del cache de datos, no del
store.

**Por qué Zustand y no Context.** El store se lee con **selectores** —cada
componente se re-renderiza solo cuando cambia lo que usa—, no obliga a envolver
el árbol en providers, y si el estado global crece (un carrito, selección de
butacas en vivo) escala sin el problema de re-render que tiene Context. La
contra es una dependencia; es una que paga.

Lo global de verdad hoy es **uno solo**: la sesión.

```ts
// shared/session/sessionStore.ts
import { create } from 'zustand'
import { apiFetch } from '@/shared/utils/api'
import type { Usuario } from './types'

interface SessionState {
  usuario: Usuario | null
  cargando: boolean
  hidratar: () => Promise<void>
  cerrarSesion: () => Promise<void>
}

export const useSession = create<SessionState>((set) => ({
  usuario: null,
  cargando: true,
  // Al arrancar la app: GET /api/me con la cookie de sesión (BFF, backend §6).
  // 401 => sin sesión, no es un error que mostrar.
  hidratar: async () => {
    const res = await apiFetch<Usuario>('/api/me')
    set({ usuario: res.ok ? res.value : null, cargando: false })
  },
  cerrarSesion: async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' })
    set({ usuario: null })
  },
}))
```

Consumo — siempre con selector, nunca el store entero:

```ts
const usuario = useSession(s => s.usuario)
const esAdmin = useSession(s => s.usuario?.esAdmin ?? false) // derivado, no se guarda
```

Reglas del store:

- **Un store por preocupación, no un mega-store.** Si mañana hacen falta toasts
  globales, es otro store chico (`useToasts`), no un campo más en la sesión.
- **Nada de datos del servidor acá** — eso es cache.
- **Derivados con selector, no campos guardados.** `esAdmin` sale de `usuario`;
  guardarlo aparte crea dos fuentes de verdad que se desincronizan.
- **Se lee con selector** (`useSession(s => s.x)`), no `useSession()` completo:
  el store entero re-renderiza ante cualquier cambio.
- **Se hidrata una vez** al montar la app —`useSession.getState().hidratar()`—
  antes de resolver rutas protegidas.

`GET /api/me` ya existe (CSH.Usuarios) y crea el perfil si no hay fila.
`POST /api/auth/logout` cierra la cookie. El store Zustand de sesión **todavía
no está en el frontend** — este snippet es el contrato a implementar, no un
archivo que ya viva en `shared/session/`.

En local, hidratar contra Vite (`:5173`) no ve la cookie del BFF hasta que el
callback OIDC pase por el proxy; ver [`harness_DEV.md` §3](harness_DEV.md).

El móvil, si comparte la sesión, **espeja esta forma**; cambia solo la
hidratación —manda bearer (access token) en vez de cookie— igual que con
`apiFetch`. El access token no trae los mismos claims que la cookie: ver
[`harness_DEV_backend.md` §6](harness_DEV_backend.md).

---

## 5. Pendiente de crear

Estas piezas existían en la aplicación anterior y se van a necesitar de nuevo,
pero **todavía no están** en `frontend/`. Quien las cree primero las agrega acá
y en `shared/`:

| Pieza | Para qué |
|---|---|
| `useEscClose(onClose)` | Cerrar modales y paneles con Escape |
| `useConfirm()` | Confirmar acciones destructivas del admin |
| `lucide-react` | Íconos — es la librería elegida, falta instalarla |
| `zustand` | Estado global (§4) — es la librería elegida, falta instalarla |
| `@tanstack/react-query` | Cache de datos ([cliente §4](harness_DEV_cliente.md)) — es la librería elegida, falta instalarla |

Mientras no existan, no las cites en código: el import no resuelve.
