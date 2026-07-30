# CSH — contexto operativo para agentes

Club Sport Herediano: sitio público del club, panel de administración y
módulos de venta (entradas, parqueo, cuponera, restaurantes, alquiler de
salones). Es producción real y cobra con Stripe.

## Estructura

```
/                andamiaje — no es la app
├── app/         LA APLICACIÓN: todo el código de producto
├── harness/     el harness agéntico (docs/HARNESS.md)
├── scripts/     utilidades de CI: aviso a Discord, intake de issues
├── docs/        documentación
└── .github/     workflows y plantillas de issue
```

Todo lo que un agente implementa vive en `app/`. La raíz es infraestructura.

## Stack

TypeScript estricto + Express 5 en `app/server`, React 19 en `app/src`
(JSX, sin TypeScript), Vite 8, PostgreSQL vía `pg` sin ORM, Vitest. El SQL
se escribe a mano en los `*.schema.ts` y `*.repository*.ts`.

No hay linter — ver [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Reglas duras

- **Nunca** pushear a `main`. `main` solo recibe PR desde `dev`.
- **Nunca** commitear, pushear ni abrir PR desde dentro de una corrida del
  agente. De eso se encarga el harness.
- **Nunca** editar un `*.test.ts` / `*.test.js` para que pase un gate. Si un
  test estorba, o el trabajo está mal o la story está mal. Decilo y parás.
- **Nunca** agregar una dependencia que la story no pida explícitamente.
- **Nunca** modificar un `app/migrations/*.sql` existente: son historia ya
  aplicada. Un cambio de esquema es un archivo nuevo numerado.
- **Nunca** imprimir, citar ni commitear secretos. `.env`, `ALL_SECRETS` y
  las llaves de Stripe no se leen.
- Las llaves de Stripe son de prueba (`sk_test_`). El servidor aborta el
  arranque si detecta una `sk_live_`.

## Comandos

Todos desde la raíz del repo:

```bash
npm --prefix app ci                # instalar
npm --prefix app run check         # tsc --noEmit + build del cliente
npm --prefix app run test:unit     # 93 tests en 11 archivos
npm --prefix app run build:server  # compila a app/dist-server
npm --prefix app run dev           # Vite en :5173
npm --prefix app run dev:server    # Express en watch
```

`npm --prefix app run check` es el typecheck del repo. No existe `lint`.

## Convenciones

**Capas.** Cada módulo en `app/server/modules/<dominio>/` tiene el mismo
corte, sin excepciones:

```
<mod>.routes.ts       HTTP, rate limits, auth, correo
<mod>.service.ts      validación + reglas de negocio + helpers puros
<mod>.repository.ts   SQL
<mod>.schema.ts       DDL (`create table if not exists`)
<mod>.types.ts        tipos del dominio
```

**Errores.** El service lanza `ApiError(status, mensaje)`. La ruta hace
`try { … } catch (err) { next(err); }` y nada más. `errorHandler` lo traduce
a `{ ok: false, error }`. Toda respuesta exitosa es `{ ok: true, … }`. No
inventar otro formato.

**Tests.** Solo se testean helpers **puros y exportados** del service; el
repositorio se mockea con `vi.mock`. Si algo necesita la base de datos para
probarse, extraé la lógica a un helper puro y testeá ese.

**Idioma.** El dominio se nombra en español (`entradas`, `parqueo`,
`calcularPrecio`); la infraestructura en inglés (`findSalonById`,
`errorHandler`). Los comentarios van en español y explican *por qué*, no
*qué*.

**Dinero.** Siempre entero en colones, sufijo `_crc`. Nunca float.

**Rate limits.** Todo `rateLimit` nuevo lleva un comentario que justifica
por qué existe.

## Entornos

| Entorno | Rama | Puerto | Servicio | Verificar |
|---|---|---|---|---|
| dev | `dev` | 1421 | `csh-dev.service` | `curl 127.0.0.1:1421/healthz` |
| prod | `main` | 8088 | `csh.service` | `curl 127.0.0.1:8088/healthz` |

Cada push a `dev` despliega dev; cada push a `main`, producción.

## Definition of done

1. El comportamiento pedido está implementado en `app/`.
2. `npm --prefix app run check` → exit 0.
3. `npm --prefix app run test:unit` → exit 0.
4. `npm --prefix app run build:server` → exit 0.
5. El diff no toca nada fuera del alcance de la story, ni un solo test
   preexistente.
6. La lógica nueva y pura tiene test propio.

Los puntos 2–4 los vuelve a correr el harness después del agente, y **ese**
resultado es el que cuenta — ver [docs/VERIFICATION.md](docs/VERIFICATION.md).
