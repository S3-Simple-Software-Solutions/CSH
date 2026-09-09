# Instrucciones para agentes

Punto de entrada para cualquier agente (Codex, Cursor, Claude Code) que trabaje
en este repositorio. El contenido vive en el harness; este archivo solo enruta.

## Antes de tocar código

1. Leer [`docs/harness_DEV.md`](docs/harness_DEV.md) — obligatorio para toda
   tarea. Ahí está el stack, la arquitectura y a qué documento de capa ir
   según lo que toque la tarea.
2. Verificar el estado real del repo con `git status --short` y
   `git branch --show-current`. No trabajar desde memoria de sesiones
   anteriores.
3. Mantener el cambio dentro de lo pedido.

## Flujo de ramas

**La base es `dev`, no `main`.**

- Toda rama de feature sale de `dev` y su PR apunta a `dev`.
- `main` es producción y solo recibe PR desde `dev` (release).
- Nunca commitear ni pushear directo a `main`.
- Ramas cortas, en kebab o camel case, que nombren la feature.

## Validación

Los comandos exactos están en [`docs/harness_DEV.md`](docs/harness_DEV.md) §4.
No se duplican acá para que no queden desactualizados.

Al entregar, resumir qué cambió, qué se verificó y qué quedó sin verificar.

## Estado del repositorio

En `dev` existe el esqueleto .NET (`CSH.Host`, `CSH.Shared`, `frontend`) y el
primer módulo (`CSH.Usuarios`), con auth Cognito (BFF + JWT) y Docker local.
La app Node de `main` sigue siendo producción. El detalle de qué está
verificado y qué no está en [`docs/harness_DEV.md`](docs/harness_DEV.md) §7.

`docs/harness.md` describe el flujo de trabajo del stack Node anterior y está
pendiente de reescritura.
