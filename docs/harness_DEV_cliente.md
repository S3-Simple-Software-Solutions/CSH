# Harness DEV — Cliente

Extiende [`harness_DEV.md`](harness_DEV.md), que hay que leer primero.

**Aplica a los dos clientes**: la SPA (`frontend/`) y la app móvil (M9). Lo que
está acá vale para ambos; lo que se aparta va en el documento de la plataforma:

| Plataforma | Documento |
|---|---|
| Web | [`harness_DEV_web.md`](harness_DEV_web.md) |
| Móvil | [`harness_DEV_movil.md`](harness_DEV_movil.md) |

Una regla vive en un solo lugar. Si algo aplica a los dos y está escrito dos
veces, en tres semanas dicen cosas distintas y nadie sabe cuál gana.

---

## 1. Estructura por módulo

Los clientes espejan los bounded contexts del backend: un directorio en
`modules/` por cada módulo de la solución.

```
src/
├── modules/                 ← un directorio por bounded context
│   ├── entradas/
│   │   ├── api.ts           ← llamadas API tipadas de este módulo
│   │   ├── types.ts         ← tipos del dominio (espejan el backend)
│   │   └── …                ← pantallas, según la plataforma
│   └── parqueo/
└── shared/                  ← lo reutilizable
    ├── components/
    ├── hooks/
    └── utils/
```

**Un módulo no importa de otro módulo.** Lo compartido va a `shared/`. Es la
misma regla que en el backend, donde la enforcea el compilador; acá la enforcea
la revisión, hasta que exista la regla de ESLint
([`harness_DEV.md §5`](harness_DEV.md)).

---

## 2. TypeScript strict

`"strict": true` en el `tsconfig`. Prohibido:

- `any` explícito — usar `unknown` y type guards.
- `!` non-null assertion sin un comentario que justifique por qué es seguro.
- Props sin tipar.
- `@ts-ignore` — si hace falta, es `@ts-expect-error` con explicación.

Los tipos del dominio en `types.ts` espejan los DTO del backend. Si el backend
cambia un contrato, este archivo se actualiza en el mismo PR.

---

## 3. Llamadas API

### El contrato de respuesta

El backend responde con status codes y RFC 9457 Problem Details
([`harness_DEV_backend.md §3`](harness_DEV_backend.md)). Los dos clientes lo
traducen a la **misma discriminated union**, para que el compilador obligue a
manejar el error antes de tocar el valor:

```ts
export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; title: string; detail: string; errors?: Record<string, string[]> }
```

**Este tipo es idéntico en web y en móvil.** La implementación de `apiFetch`
difiere —la web manda cookie, el móvil manda bearer— pero la forma del
resultado no, porque es lo que consume el código de pantalla.

### `apiFetch` es el único lugar que llama a `fetch`

Nunca `fetch()` directo desde un componente o una pantalla. Cada plataforma
tiene su implementación en `shared/`, documentada en su archivo.

### El `api.ts` de cada módulo

```ts
// modules/entradas/api.ts
import { apiFetch } from '@/shared/utils/api'
import type { Evento, CrearEventoRequest } from './types'

export const entradasApi = {
  listarEventos: () =>
    apiFetch<Evento[]>('/api/eventos'),
  crearEvento: (data: CrearEventoRequest) =>
    apiFetch<Evento>('/api/eventos', { method: 'POST', body: JSON.stringify(data) }),
}
```

### Consumo — el compilador estrecha el tipo

```ts
const res = await entradasApi.crearEvento(datos)
if (!res.ok) {
  setError(res.detail)        // acá `res.value` no existe — el compilador lo sabe
  return
}
irA(`/eventos/${res.value.id}`)   // acá `res.value` está tipado
```

---

## 4. Carga de datos

El fetching, la caché, los reintentos y el refetch los maneja **TanStack
Query**, no un `useEffect` a mano. Es la misma pieza en los dos clientes
([`harness_DEV_movil.md §4`](harness_DEV_movil.md)): una sola dependencia
resuelve caché con deduplicación, invalidación y refetch en segundo plano, en
vez de repetir los tres estados a mano en cada pantalla.

Query **envuelve `apiFetch`, no lo reemplaza**: `apiFetch` sigue siendo el único
lugar que llama a `fetch` (§3). El puente es el `queryFn`, que convierte el
`ApiResult` en el modelo de Query —throw en error, valor en éxito—:

```ts
// modules/entradas/hooks.ts
export function useEventos() {
  return useQuery({
    queryKey: ['eventos'],
    queryFn: async () => {
      const res = await entradasApi.listarEventos()
      if (!res.ok) throw res       // el error tipado (title/detail) viaja como rechazo
      return res.value
    },
  })
}
```

```ts
// En la pantalla — los tres estados salen del hook, no de useState sueltos
const { data, isPending, error } = useEventos()
```

Los tres estados se muestran **siempre** — nunca una pantalla en blanco:

| Estado de Query | Qué se muestra |
|---|---|
| `isPending` | El indicador de la plataforma |
| `error` | El `detail` del `ApiResult`, que ya viene escrito para el usuario final |
| `data` vacío | Un texto que explique que no hay nada, no una lista vacía sin contexto |

**Tras una mutación se invalida la query**, no se re-arma el estado a mano — así
la caché no queda mostrando datos viejos:

```ts
const qc = useQueryClient()
await entradasApi.crearEvento(datos)
qc.invalidateQueries({ queryKey: ['eventos'] })   // la lista se refresca sola
```

Cada plataforma monta su `QueryClientProvider` en la raíz (web en `main.tsx`,
móvil en el layout raíz de expo-router). Es una librería elegida; en la web
todavía falta instalarla ([`harness_DEV_web.md §5`](harness_DEV_web.md)).

---

## 5. Componentes

- Solo componentes funcionales.
- Props tipadas con `interface` o `type` explícito.
- Form state con updater funcional: `setForm(prev => ({ ...prev, campo: valor }))`
  — el spread directo sobre `form` pierde updates si hay dos seguidos.
- Nada de `!` para acceder a algo que puede no estar: si puede faltar, se chequea.

---

## 6. Nombres

Los del [glosario](glosario.md), sin excepciones. Si en el backend es `Butaca`,
en la web es `Butaca` y en el móvil también. Un componente que se llame
`SeatPicker` cuando el dominio dice butaca es deuda de lenguaje desde el
primer día.

---

## 7. Copy

El texto que ve el usuario es parte del trabajo, no un relleno:

- Los errores del backend **ya vienen escritos para mostrarse** (`detail`). No
  los reemplaces por "Ocurrió un error".
- Los botones dicen qué hacen: "Comprar entradas", no "Enviar".
- En español de Costa Rica, consistente entre las dos plataformas.

Ese último punto no es cosmético: si la web dice "Sin conexión" y el móvil dice
"Error de red" para el mismo fallo, es el mismo producto contándole dos
historias distintas a la misma persona.

---

## 8. Testing

Ver [`harness_DEV_testing.md`](harness_DEV_testing.md). La filosofía es la
misma en las dos plataformas: se verifica **lo que ve el usuario** —texto,
roles, etiquetas— no la implementación interna, y se mockea el `api.ts` del
módulo, no `fetch`.
