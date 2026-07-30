
# Harness de agentes — CSH

> Contrato general de trabajo para cualquier agente (cursor, Claude Code, Codex, u
> otro) que edite este repositorio. Es el harness "raíz": las reglas que
> aplican sin importar la herramienta ni el rol. Los harnesses de rol
> ([harness_DEV.md](harness_DEV.md), [harness_QA.md](harness_QA.md),
> [harness_Infra.md](harness_Infra.md)) heredan de este documento y afinan el
> comportamiento para su dominio — ver §5.

<!-- TODO: una o dos frases de objetivo — qué problema evita este harness,
     por qué existe (ej. incidentes pasados, ramas divergentes, deploys sin
     avisar, etc.) -->

## 1. Principios

*Descripción:* reglas de fondo, agnósticas de herramienta y de tarea. Todo lo
demás en este documento es una aplicación concreta de estos principios; si un
caso nuevo no está cubierto abajo, se resuelve volviendo a estos.

*Ejemplo:*

- Trabajar desde el estado real del repo, no desde memoria de sesiones
  anteriores.
- Preservar cambios del usuario que el agente no hizo.
- Diffs pequeños y revisables antes que reescrituras grandes.
- cualquier cambio a este harness o otro harness file debe ser publicado inmediatamente. 

<!-- TODO: completar / ajustar la lista de principios -->

## 2. Rama base y flujo de ramas

*Descripción:* de qué rama sale el trabajo, a qué rama apunta cada PR, y qué
rama nunca se toca directamente. Ver diagrama en
[diagramas.md § CI/CD](diagramas.md#cicd).

*Ejemplo:*

```text
dev   -> es la base: toda rama de feature sale de dev y su PR apunta a dev
main  -> solo recibe PR desde dev (release); nunca push directo ni reset
```

<!-- TODO: completar reglas de excepción (hotfix, rollback, etc.) -->

## 3. Flujo estándar de tarea

*Descripción:* el camino repetible de "pedido" a "PR revisado", como lista de
fases. Cada fase se documenta con los comandos/checks concretos de este repo.

*Ejemplo (fase 1, como modelo del nivel de detalle esperado):*

```bash
# 1. Inspeccionar estado
git status --short
git branch --show-current
git fetch origin
```

Fases restantes (completar con el mismo nivel de detalle que la fase 1):

1. Inspeccionar estado — ✅ ejemplo arriba
2. Entender el patrón local antes de editar
3. Implementar en cambios pequeños
4. Validar (build/tests/verificación manual)
5. Revisar el diff
6. Commit
7. Push + abrir PR
8. Vigilar CI
9. Anunciar el deploy/versión

<!-- TODO: completar fases 2-9 con comandos reales de este repo -->

## 4. Entornos

*Descripción:* dónde vive cada ambiente, puerto, cómo se despliega y cómo se
verifica que el deploy tomó. Detalle de infraestructura vigente en
[diagramas.md](diagramas.md) e [infra.md](infra.md).

*Ejemplo:*

| Entorno | Rama que dispara deploy | Puerto | URL | Cómo verificar |
|---|---|---|---|---|
| dev | `dev` | 1421 | herediano-dev.milocalhost.work | `curl 127.0.0.1:1421/healthz` |
| prod | `main` | 8088 | (completar) | (completar) |

<!-- TODO: completar filas / URLs / healthchecks reales -->

## 5. Agentes de rol (QA / DEV / Infra)

*Descripción:* este harness cubre el contrato común. Cada rol especializado
tiene su propio documento con lo específico de su dominio (qué valida, qué
puede tocar, qué NO debe tocar). Pendiente de definir — por ahora son stubs.

*Ejemplo (formato esperado de la tabla, a completar cuando se definan):*

| Rol | Harness | Responsabilidad | Estado |
|---|---|---|---|
| DEV | [harness_DEV.md](harness_DEV.md) | Implementar features/fixes siguiendo §2-§3 | pendiente de definir |
| QA | [harness_QA.md](harness_QA.md) | Tests y reglas de validación antes de PR | pendiente de definir |
| Infra | [harness_Infra.md](harness_Infra.md) | Deploy, entornos, secretos, rollback | pendiente de definir |

<!-- TODO: cuando se definan los harness de rol, decidir aquí si un agente de
     rol puede saltarse alguna regla de este documento raíz o si son
     estrictamente aditivos -->

## 6. Soporte multi-herramienta (Claude Code / Codex)

*Descripción:* qué es común a cualquier herramienta (todo lo de arriba) y qué
cambia según la herramienta que ejecuta al agente — dónde vive su config,
cómo lee este harness, qué permisos tiene por defecto.

*Ejemplo:*

| | Claude Code | Codex |
|---|---|---|
| Config/permisos | `.claude/settings.json` | (completar — config equivalente) |
| Archivo de entrada al harness | `docs/harness.md` (este archivo) | (completar — ¿`AGENTS.md` en la raíz que apunte aquí?) |
| Invocación en este repo | sesión interactiva en `cleandev`/rama de trabajo | (completar) |

<!-- TODO: completar la columna Codex; decidir si hace falta un AGENTS.md en
     la raíz del repo que simplemente apunte a docs/harness.md -->

## 7. Definición de "hecho"

*Descripción:* checklist mínimo para considerar cerrada una tarea de agente,
sin importar el rol o la herramienta.

*Ejemplo:*

- [ ] El comportamiento pedido está implementado.
- [ ] Los checks/tests relevantes pasan.
- [ ] El deploy (si aplica) se anunció con versión + qué trae + cómo probarlo.

<!-- TODO: completar checklist -->

## 8. Comunicación y handoff

*Descripción:* cómo el agente avisa lo que hizo y cómo deja el contexto para
quien continúe — el mismo agente en otra sesión, otro agente, o el humano. No
es solo "avisar al final": también es dejar suficiente rastro para que el
siguiente no tenga que re-descubrir el estado desde cero.

*Ejemplo:*

- **Anuncio de deploy/versión:** siempre incluye qué versión (`dev-<sha>` o
  `0.X`), qué trae (asuntos de los commits, no solo el SHA) y cómo probarlo
  (URL/entorno). Un deploy que nadie sabe que existe es un deploy que nadie
  prueba.
- **Cuerpo del PR:** resumen, comandos de validación corridos y su resultado,
  riesgos o pendientes conocidos.
- **Handoff de trabajo largo (varias sesiones):** nota breve de progreso
  (objetivo actual, hecho, falta, bloqueos) en el cuerpo del PR o en un
  archivo temporal — se borra antes de mergear salvo que sea documentación
  útil de por sí.

<!-- TODO: completar plantilla exacta de PR body, de nota de progreso, y
     canal(es) real(es) de anuncio (ej. Discord) -->

## 9. Mantenimiento de este harness

*Descripción:* cuándo y cómo se actualiza este documento.

*Ejemplo:* si un agente repite un error evitable, o el flujo del repo cambia
(como pasó con la migración de rama base a `dev`, ver memoria
`never-push-to-main`), se actualiza esta sección correspondiente en el mismo
PR que corrige el problema — no se deja para después.
