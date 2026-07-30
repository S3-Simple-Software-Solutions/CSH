# Spec del harness

Ejecuta:

```bash
node harness/src/main.mjs <issue-number>
```

Node ESM, **cero dependencias npm**. Habla con GitHub por el CLI de `gh` y
con el modelo por el CLI de `claude`, ambos como sub-procesos. Si esos dos
binarios están instalados y autenticados, el harness corre.

El diseño y el porqué están en [AGENTIC.md](AGENTIC.md). Esto es la spec.

## Los cuatro contratos

### 1. Entrada — qué es una story válida

El harness recibe **un número de issue**, nada más. Todo lo demás lo lee de
GitHub. Una story es ejecutable si cumple **todas**:

| Condición | Motivo |
|---|---|
| El issue existe y está abierto | — |
| Tiene el label `agent-ready` | Opt-in explícito: nada entra por accidente |
| Tiene criterios de aceptación no vacíos | Sin esto no hay forma de saber si terminó |
| El cuerpo tiene ≥ 1 criterio verificable por comando | Ver [STORIES.md](STORIES.md) |
| No tiene ya un PR abierto de esta rama | Evita corridas duplicadas |

Si falla cualquiera: **abortar antes de crear el worktree**, comentar en el
issue por qué, exit ≠ 0. No se toca el repo.

### 2. Contexto — qué recibe el agente

Se arma siempre igual, para que dos corridas de la misma story sean
comparables:

1. La story: título, cuerpo y criterios de aceptación del issue.
2. `CLAUDE.md` completo — estructura, reglas duras, convenciones.
3. Los comandos exactos que se van a correr como gates, **antes** de que
   empiece, para que los corra él también.
4. Los límites duros: qué no puede tocar, y que no ejecuta git.
5. El número de intento y, si es reintento, el stdout real del gate que
   falló.

Lo que **no** se le manda: el repo indexado, resúmenes generados, ni
historial de corridas anteriores. Lee lo que necesite con sus herramientas.

### 3. Verificación — cómo se decide si pasó

Definido en [VERIFICATION.md](VERIFICATION.md). Resumen: cuatro gates
bloqueantes, en orden, cada uno por exit code, corridos por el harness sobre
el árbol final.

### 4. Salida — qué produce una corrida

**Si pasó:** rama `agent/<issue>-<slug>`, un commit con la referencia al
issue, push, y PR contra `dev` cuyo cuerpo trae el resumen del agente, la
tabla de gates con sus exit codes y el link al trace. Exit 0.

**Si falló:** ningún commit, ningún push, ningún PR. El worktree se conserva
para inspección, se comenta el issue con el gate que falló y su salida
recortada, y exit ≠ 0.

El harness nunca mergea, nunca toca `main`, y nunca borra ramas.

## Archivos

```
harness/
├── harness.config.json      rama base, modelo, gates, límites de reintento
├── prompts/
│   ├── implementer.md       instrucciones del agente implementador
│   └── retry.md             qué se le dice cuando un gate falló
└── src/
    ├── main.mjs             entrypoint: parsea argv, orquesta, fija el exit code
    ├── config.mjs           carga y valida harness.config.json; falla temprano si falta algo
    ├── github.mjs           único lugar que invoca `gh`: leer issue, comentar, crear PR
    ├── validate.mjs         contrato de entrada: decide si la story es ejecutable
    ├── sandbox.mjs          crea y destruye el git worktree de la corrida
    ├── agent.mjs            invoca el CLI de `claude` como sub-proceso y captura su salida
    ├── verify.mjs           corre los gates en orden y devuelve exit codes; el juez
    ├── scope.mjs            gate de alcance: qué archivos tocó el diff
    ├── loop.mjs             la máquina de estados: intake→sandbox→agente→gates→reintento→salida
    └── trace.mjs            escribe todo a .harness-runs/<runId>/
```

`sandbox.mjs`, `agent.mjs`, `verify.mjs` y `scope.mjs` no estaban en el
boceto original: salen de las decisiones tomadas (worktree, CLI de claude,
juez externo, gate de alcance). El resto es el boceto tal cual.

## Trace

Una carpeta por corrida, bajo `.harness-runs/` (ignorada por git):

```
.harness-runs/2026-07-30T14-22-01Z-112-nuevo-test-de-venues/
├── run.json             veredicto, timings, exit codes, sha, rama, url del PR
├── issue.json           el issue tal como lo devolvió `gh`, sin procesar
├── prompt-1.md          contexto exacto del intento 1
├── agent-1.log          salida cruda del CLI de claude
├── agent-1.md           el mensaje final del agente (su afirmación, no un veredicto)
├── gates-1/
│   ├── 1-check.log      stdout+stderr y exit code de cada gate
│   ├── 2-test-unit.log
│   ├── 3-build-server.log
│   └── 4-scope.json     archivos tocados y por qué pasó o no
├── prompt-2.md          si hubo reintento, todo lo anterior se repite con -2
├── diff.patch           el diff final completo
└── pr-body.md           lo que se publicó en el PR
```

`run.json` es lo que se lee primero:

```json
{
  "runId": "2026-07-30T14-22-01Z-112-nuevo-test-de-venues",
  "issue": 112,
  "branch": "agent/112-nuevo-test-de-venues",
  "baseBranch": "dev",
  "model": "opus",
  "verdict": "passed",
  "attempts": 1,
  "gates": [
    { "name": "check", "cmd": "npm --prefix app run check", "exit": 0, "ms": 4120 },
    { "name": "test:unit", "cmd": "npm --prefix app run test:unit", "exit": 0, "ms": 1890 },
    { "name": "build:server", "cmd": "npm --prefix app run build:server", "exit": 0, "ms": 2604 },
    { "name": "scope", "cmd": "internal", "exit": 0, "ms": 12 }
  ],
  "filesChanged": ["app/server/modules/venues/venues.service.ts"],
  "prUrl": "https://github.com/S3-Simple-Software-Solutions/CSH/pull/114",
  "startedAt": "2026-07-30T14:22:01Z",
  "finishedAt": "2026-07-30T14:26:44Z"
}
```

Los logs de gate se guardan **completos** en disco. El recorte (primeras 20
líneas + últimas 30) es solo para lo que se le devuelve al agente en el
reintento y para el comentario del issue.

## Reintentos

**Máximo 2 reintentos** (3 intentos en total). En cada uno se le devuelve al
agente el nombre del gate que falló y su salida recortada — nada más. No se
le sugiere el arreglo.

Un reintento sin techo es cómo se quema presupuesto y cómo un agente
acorralado termina borrando el test que le molesta.

### Cuándo aborta sin reintentar

No todo fallo es culpa del agente, y reintentar lo que no depende de él solo
gasta corridas:

| Condición | Por qué no se reintenta |
|---|---|
| La story no pasa el contrato de entrada | No hay nada que implementar |
| `npm --prefix app ci` falla (gate 0) | El entorno está roto, no el trabajo |
| El diff toca un `*.test.*` que la story no pidió | Es sabotaje del gate, no un error |
| El diff toca archivos fuera de `app/` sin pedido | Fuera de alcance |
| El CLI de `claude` falla o corta | Falla de herramienta |
| El worktree quedó sin cambios | El agente no hizo nada; reintentar da lo mismo |
| Se agotaron los 2 reintentos | — |

En todos los casos: sin commit, sin PR, worktree conservado, issue
comentado, exit ≠ 0.

## Configuración

`harness/harness.config.json`:

```json
{
  "baseBranch": "dev",
  "branchPrefix": "agent",
  "requiredLabel": "agent-ready",
  "model": "opus",
  "maxRetries": 2,
  "runRoot": ".harness-runs",
  "workdir": "app",
  "gates": [
    { "name": "install",      "cmd": "npm --prefix app ci",               "blocking": true, "retryable": false },
    { "name": "check",        "cmd": "npm --prefix app run check",        "blocking": true, "retryable": true },
    { "name": "test:unit",    "cmd": "npm --prefix app run test:unit",    "blocking": true, "retryable": true },
    { "name": "build:server", "cmd": "npm --prefix app run build:server", "blocking": true, "retryable": true }
  ],
  "scope": {
    "allow": ["app/**"],
    "denyUnlessRequested": ["**/*.test.ts", "**/*.test.js", "app/migrations/**"]
  }
}
```

## Pendientes

- **`gh` autenticado como persona.** Las corridas del harness aparecen como
  el usuario dueño del token. Falta decidir si conviene una cuenta de bot.
- **Sin límite de tiempo por corrida.** Un agente colgado bloquea el
  worktree indefinidamente.
- **Sin ejecución concurrente.** Dos corridas simultáneas competirían por
  `app/node_modules` si el worktree lo comparte.
