# Harness DEV — Frontend

Extiende [`harness_DEV.md`](harness_DEV.md), que hay que leer primero.
Aplica a toda tarea que toque React, TypeScript o CSS.

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

### A dónde va

El frontend espeja los bounded contexts del backend: un directorio en
`modules/` por cada módulo de la solución. **Todavía no existe ninguno** — lo
crea el primer módulo que se implemente.

```
frontend/src/
├── modules/                 ← un directorio por bounded context
│   ├── entradas/
│   │   ├── api.ts           ← llamadas API tipadas de este módulo
│   │   ├── types.ts         ← tipos del dominio (espejan el backend)
│   │   └── pages/
│   └── parqueo/
├── shared/
│   ├── components/
│   ├── hooks/               ← todavía vacío
│   └── utils/
└── main.tsx                 ← router y composición de la app
```

Un módulo no importa de otro módulo. Lo compartido va a `shared/`.

---

## 2. TypeScript strict

`tsconfig.json` tiene `"strict": true`. Prohibido:

- `any` explícito — usar `unknown` y type guards.
- `!` non-null assertion sin un comentario que justifique por qué es seguro.
- Props sin tipar.
- `@ts-ignore` — si hace falta, es `@ts-expect-error` con explicación.

Los tipos del dominio en `types.ts` espejan los DTO del backend. Si el backend
cambia un contrato, este archivo se actualiza en el mismo PR.

---

## 3. Llamadas API

### apiFetch — el único lugar que llama a `fetch`

Traduce el contrato HTTP del backend (ver
[`harness_DEV_backend.md §3`](harness_DEV_backend.md)) a una discriminated
union, para que el compilador obligue a manejar el error:

El código vive en `frontend/src/shared/utils/api.ts`. Este es el archivo real,
no un ejemplo:

```ts
export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; title: string; detail: string; errors?: Record<string, string[]> }

/** Forma de RFC 9457 Problem Details, tal como la emite ASP.NET Core. */
interface ProblemDetails {
  title?: string
  detail?: string
  status?: number
  errors?: Record<string, string[]>
}

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

Dos detalles que parecen menores y no lo son: el orden de `headers` respecto al
spread, y el `catch` alrededor del `fetch`. Los dos están explicados arriba
porque son los que se rompen al reescribir esta función de memoria.

### El api.ts de cada módulo

```ts
// modules/entradas/api.ts
import { apiFetch } from '@/shared/utils/api';
import type { Evento, CrearEventoRequest } from './types';

export const entradasApi = {
  listarEventos: () =>
    apiFetch<Evento[]>('/api/eventos'),
  crearEvento: (data: CrearEventoRequest) =>
    apiFetch<Evento>('/api/eventos', { method: 'POST', body: JSON.stringify(data) }),
};
```

**Nunca** llamar `fetch()` directo desde un componente o una página.

### Consumo — el compilador estrecha el tipo

```ts
const res = await entradasApi.crearEvento(datos);
if (!res.ok) {
  setError(res.detail);        // acá `res.value` no existe — el compilador lo sabe
  return;
}
navigate(`/eventos/${res.value.id}`);   // acá `res.value` está tipado
```

---

## 4. Carga de datos en un componente

```ts
const [data, setData] = useState<Evento[] | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  entradasApi.listarEventos().then(res => {
    if (res.ok) setData(res.value);
    else setError(res.detail);
    setLoading(false);
  });
}, []);
```

Los tres estados se muestran siempre — nunca una pantalla en blanco:

- `loading` → `<LoadingBlock />`
- `error` → el mensaje de `detail`, que ya viene escrito para el usuario final
- vacío → un texto que explique que no hay nada, no una lista vacía sin contexto

---

## 5. Componentes

- Solo componentes funcionales.
- Props tipadas con `interface` o `type` explícito.
- Form state con updater funcional: `setForm(prev => ({ ...prev, campo: valor }))`
  — el spread directo sobre `form` pierde updates si hay dos seguidos.
- Sin `!` para el nodo raíz ni para nada: si algo puede faltar, se chequea.

### Pendiente de crear

Estas piezas existían en la aplicación anterior y se van a necesitar de nuevo,
pero **todavía no están** en `frontend/`. Quien las cree primero las agrega acá
y en `shared/`:

| Pieza | Para qué |
|---|---|
| `useEscClose(onClose)` | Cerrar modales y paneles con Escape |
| `useConfirm()` | Confirmar acciones destructivas del admin |
| `lucide-react` | Íconos — es la librería elegida, falta instalarla |

Mientras no existan, no las cites en código: el import no resuelve.

---

## 6. Estilos

- CSS variables del sistema — nunca hardcodear colores (`--bg`, `--gold`,
  `--muted`, `--surface`, etc.).
- Dark mode por defecto; light mode via `html[data-theme='light']`.
- Sin Tailwind, sin styled-components, sin CSS-in-JS.
- Fuentes definidas hoy en `frontend/src/index.css`: `--font-display` y
  `--font-body`. La aplicación anterior tenía además `--font-label` (Oswald) y
  `--font-accent` (Playfair Display); si se necesitan, se agregan ahí primero.
- `@media (prefers-reduced-motion: reduce)` en cualquier cosa que anime.

---

## 7. Copy

El texto que ve el usuario es parte del trabajo, no un relleno:

- Los errores del backend ya vienen escritos para mostrarse (`detail`). No los
  reemplaces por "Ocurrió un error".
- Los botones dicen qué hacen: "Comprar entradas", no "Enviar".
- En español de Costa Rica, consistente con el resto del sitio.
