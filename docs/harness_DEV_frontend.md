# Harness DEV — Frontend

Extiende [`harness_DEV.md`](harness_DEV.md), que hay que leer primero.
Aplica a toda tarea que toque React, TypeScript o CSS.

---

## 1. Estructura

El frontend espeja los bounded contexts del backend: un directorio en
`modules/` por cada módulo de la solución.

```
ClientApp/src/
├── modules/                 ← un directorio por bounded context
│   ├── entradas/
│   │   ├── api.ts           ← llamadas API tipadas de este módulo
│   │   ├── types.ts         ← tipos del dominio (espejan el backend)
│   │   └── pages/
│   └── parqueo/
├── shared/                  ← componentes y utilidades reutilizables
│   ├── components/
│   ├── hooks/
│   └── utils/
│       └── api.ts           ← apiFetch, único punto de salida HTTP
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

```ts
// shared/utils/api.ts
export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; title: string; detail: string; errors?: Record<string, string[]> };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
    ...init,
  });

  if (res.status === 204) return { ok: true, value: undefined as T };
  if (res.ok) return { ok: true, value: await res.json() as T };

  const problem = await res.json().catch(() => null);
  return {
    ok: false,
    status: res.status,
    title: problem?.title ?? 'Error de conexión',
    detail: problem?.detail ?? 'No se pudo completar la operación.',
    errors: problem?.errors,
  };
}
```

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
- `useEscClose(onClose)` en cualquier modal o panel con cierre.
- `useConfirm()` para acciones destructivas (eliminar, cancelar, etc.).
- Form state con updater funcional: `setForm(prev => ({ ...prev, campo: valor }))`
  — el spread directo sobre `form` pierde updates si hay dos seguidos.
- Íconos de `lucide-react` únicamente.

---

## 6. Estilos

- CSS variables del sistema — nunca hardcodear colores (`--bg`, `--gold`,
  `--muted`, `--surface`, etc.).
- Dark mode por defecto; light mode via `html[data-theme='light']`.
- Sin Tailwind, sin styled-components, sin CSS-in-JS.
- Fuentes del proyecto: `--font-display`, `--font-label`, `--font-accent`,
  `--font-body`.

---

## 7. Copy

El texto que ve el usuario es parte del trabajo, no un relleno:

- Los errores del backend ya vienen escritos para mostrarse (`detail`). No los
  reemplaces por "Ocurrió un error".
- Los botones dicen qué hacen: "Comprar entradas", no "Enviar".
- En español de Costa Rica, consistente con el resto del sitio.
