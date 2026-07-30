# Harness de agentes — CSH

Este documento se dividió. El contenido vive ahora en:

| Tema | Documento |
|---|---|
| Contexto operativo, reglas duras, comandos, convenciones, DoD | [`../CLAUDE.md`](../CLAUDE.md) |
| Cómo funciona el sistema agéntico y por qué | [`AGENTIC.md`](AGENTIC.md) |
| Spec del harness: contratos, archivos, trace, reintentos | [`HARNESS.md`](HARNESS.md) |
| Los gates y qué significa cada exit code | [`VERIFICATION.md`](VERIFICATION.md) |
| Cómo escribir un issue que el agente pueda ejecutar | [`STORIES.md`](STORIES.md) |
| Roles de agente y sus límites | [`AGENTS.md`](AGENTS.md) |

Los stubs por rol (`harness_DEV.md`, `harness_QA.md`, `harness_Infra.md`)
se eliminaron: los roles se describen en [`AGENTS.md`](AGENTS.md), donde
además queda claro cuáles existen y cuáles son fase futura.

Este archivo se conserva como puntero porque `scripts/issue-approve.mjs` lo
lee en tiempo de ejecución.
