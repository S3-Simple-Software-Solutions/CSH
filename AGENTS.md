# Instrucciones para agentes

Este archivo existe por convención: es lo que leen Codex y Cursor al
arrancar. El contenido real vive en otro lado.

**Empezá por [`CLAUDE.md`](CLAUDE.md)** — estructura del repo, stack, reglas
duras, comandos y definition of done. Aplica a cualquier herramienta, no
solo a Claude Code.

Después, según lo que vayas a hacer:

| Si vas a… | Leé |
|---|---|
| Implementar una story | [`docs/AGENTS.md`](docs/AGENTS.md) — tu rol y tus límites |
| Entender el sistema completo | [`docs/AGENTIC.md`](docs/AGENTIC.md) |
| Trabajar sobre el harness | [`docs/HARNESS.md`](docs/HARNESS.md) |
| Saber qué te va a juzgar | [`docs/VERIFICATION.md`](docs/VERIFICATION.md) |
| Escribir un issue ejecutable | [`docs/STORIES.md`](docs/STORIES.md) |

## Lo mínimo, si no vas a leer nada más

- La aplicación está en `app/`. La raíz del repo es andamiaje.
- La rama base es **`dev`**. Las ramas de feature salen de `dev` y sus PR
  apuntan a `dev`. **`main` solo recibe PR desde `dev`** — nunca ramifiques
  desde `main` ni abras PR contra `main`.
- Validación antes de entregar, desde la raíz del repo:

  ```bash
  npm --prefix app run check
  npm --prefix app run test:unit
  npm --prefix app run build:server
  ```

- No modifiques tests existentes para que pase un gate.
- Resumí qué cambiaste, qué verificaste y qué quedó **sin** verificar.
