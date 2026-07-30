# Verificación — el juez

Qué comando decide si el trabajo de un agente entra o no. Es el documento
más literal de todos: acá no hay criterio, hay exit codes.

Regla única: **el veredicto lo emite el harness corriendo estos comandos
sobre el árbol final**, no el agente reportando que los corrió. El porqué
está en [AGENTIC.md](AGENTIC.md#por-qué-el-agente-nunca-se-auto-califica).

## Orden

Se corren en secuencia, desde la raíz del repo. **El primero que falla corta
la cadena** — no se sigue.

| # | Gate | Comando | Bloqueante | Reintentable |
|---|---|---|---|---|
| 0 | install | `npm --prefix app ci` | Sí | **No** |
| 1 | check | `npm --prefix app run check` | Sí | Sí |
| 2 | test:unit | `npm --prefix app run test:unit` | Sí | Sí |
| 3 | build:server | `npm --prefix app run build:server` | Sí | Sí |
| 4 | scope | interno (ver abajo) | Sí | **No** |
| — | lint | **no existe** | — | — |

El orden es de barato a caro y de general a específico: `check` tarda ~4 s y
atrapa la mayoría de los errores; `build:server` solo tiene sentido si el
typecheck ya pasó.

## Qué significa cada exit code

Todos los gates de comando siguen la convención de shell: **0 es lo único
que pasa.** Cualquier otro valor falla.

| Gate | exit 0 | exit ≠ 0 significa |
|---|---|---|
| `install` | Dependencias instaladas | `app/package-lock.json` roto, o no hay red. **El entorno está mal, no el trabajo del agente** — aborta sin reintentar |
| `check` | `tsc --noEmit` y `vite build` pasaron | Error de tipos en `app/server`, o el cliente no compila |
| `test:unit` | Los 93 tests pasaron | Al menos un test falló. Vitest devuelve 1 |
| `build:server` | `app/dist-server/` generado | `tsc` no pudo emitir. Raro si `check` pasó: suele ser un error de configuración, no de tipos |
| `scope` | El diff está dentro de lo permitido | Ver abajo |

Nota sobre `check` y `build:server`: parecen redundantes y no lo son.
`check` corre `tsc --noEmit` (typecheck del servidor) **más** `vite build`
(el cliente). `build:server` es el único que realmente emite JavaScript a
`app/dist-server/`, que es lo que arranca en producción.

## Gate 4 — alcance del diff

No corre un comando: inspecciona `git status` dentro del worktree. Falla si
el diff toca algo que la story no pidió.

| Regla | Resultado |
|---|---|
| Archivos bajo `app/**` | Permitido |
| Archivos fuera de `app/**` | **Falla** salvo que la story lo pida explícitamente |
| Cualquier `*.test.ts` / `*.test.js` preexistente modificado | **Falla** salvo que la story lo pida |
| `app/migrations/*.sql` existente modificado | **Falla** siempre — son historia aplicada |
| `app/migrations/<nuevo>.sql` agregado | Permitido |
| Cero archivos cambiados | **Falla** — el agente no hizo nada |

Este gate es la contraparte obligatoria del gate 2. Hacer los tests
bloqueantes sin vigilar el diff crea el incentivo exacto de romperlos:
borrar el test, agregarle `.skip`, o sumar otro `--exclude` al script
`test:unit` (que ya tiene cinco) son tres formas de poner el gate en verde
con el trabajo roto.

Por eso `scope` **no es reintentable**: tocar un test ajeno no es un error
que se corrige reintentando, es una señal de que la corrida salió del
carril.

## Lint — TODO

**No existe.** Verificado: no hay ESLint, Prettier ni Biome en el repo — ni
config, ni dependencia, ni script en `app/package.json`. Ninguna regla de
formato o estilo se verifica automáticamente hoy, ni en el harness ni en CI.

Queda pendiente decidir si se agrega. Mientras no exista, **no inventar un
gate de lint** ni pedirle al agente que "respete el estilo": el estilo se
transmite por las convenciones de `CLAUDE.md` y por leer el código vecino.

## Advertencias — ninguna, todavía

Hoy los cuatro gates son bloqueantes y no hay ninguno que solo advierta.
Se deja anotado por si aparece uno: un gate de advertencia registra su
salida en el trace y en el cuerpo del PR, pero **no** impide abrir el PR.

Candidato natural cuando exista: cobertura de tests.

## Lo que verifica CI, y no este juez

`.github/workflows/main-merge-ci.yml` corre en PRs hacia `main` — o sea,
**después** de que el harness ya abrió su PR contra `dev`. No se solapan.

| Gate de CI | ¿Lo corre el harness? |
|---|---|
| `npm ci` + `npm run test:unit` | Sí (gates 0 y 2) |
| `npm run check` + `npm run build:server` | Sí (gates 1 y 3) |
| `dependency-review` (falla en severidad alta) | **No** |
| Arrancar la app + `curl /healthz` contra Postgres real | **No** |
| Verificar que el HTML sirva `<div id="root"></div>` | **No** |

Los tres que el harness no corre necesitan servicios (Postgres, la app
levantada) que hoy no monta. Que un PR del harness pase sus cuatro gates
**no garantiza** que pase el CI de `main`.

Ojo con una consecuencia: un PR hacia `dev` **no dispara ningún workflow**
—`main-merge-ci.yml` solo escucha PRs hacia `main`—, así que los gates del
harness son la única verificación automática que ve un PR agéntico antes de
entrar a `dev`.

## Correrlos a mano

```bash
npm --prefix app ci
npm --prefix app run check
npm --prefix app run test:unit
npm --prefix app run build:server
```

Estado verificado el 2026-07-30 sobre la rama `cleandev`: los cuatro
terminan en 0, con 93 tests en 11 archivos.
