# Protocolo para agentes

La documentación está **solo** en `docs/`. Empieza por [`README.md`](./README.md). Ruteo: [`CATALOG.md`](./CATALOG.md).

## Qué leer (barato → caro)

| Situación | Leer | No leer |
|---|---|---|
| Primera vez en el repo / “de qué va” | `README.md` + `start/tesis.md` | referencia entera |
| Cómo se comprime / observer | `start/compresion.md` + `start/observer.md` | todos los `.mdx` de `observer/` |
| Tocar worker / SQLite / search | `start/panorama.md` + **un** archivo de `arquitectura/` (CATALOG) | `hooks.mdx` y `worker-service.mdx` a la vez “por si acaso” |
| Arrancar / QA el worker de este repo | `start/runtime.md` | `npm run worker:start` (eso es claude-mem / marketplace) |
| Identidad de sesión Cursor | `start/identidad.md` | `session-id.md` de Claude Code como si fuera Cursor |
| Captura Agent (hooks de este repo) | `start/captura.md` | `cursor-hooks/hooks.json` o `npm run cursor:install` |
| Tocar `cursor-hooks/` o inyección | `start/tesis.md` (sección Cursor) + `cursor/README.md` | `cursor/review.md` salvo que el bug esté ahí |
| Sync / cmem.ai | `start/cloud-sync.md`; detalle `arquitectura/cloud-sync.mdx` | asumir que `workers/sync-hub/` existe (se eliminó el deploy) |
| Principios (índice, context rot, modos) | `filosofia/README.md` y el archivo nombrado | instalar claude-mem como producto |

## Invariantes de este repo

- Objetivo: memoria entre chats de **Cursor** (Agent + Chat IDE), con filosofías de claude-mem, no el plugin de Claude Code.
- `start/` gana si hay conflicto con un `.mdx` de referencia (ese texto describe el producto original).
- Captura fire-and-forget; observer ≠ coder; índice primero (no dump `alwaysApply` de todo el pasado).
- No reintroducir Docker, SyncHub Cloudflare, OpenClaw, marketplace, i18n Mintlify.

## Al escribir docs nuevos

- Español en `start/`. Referencia profunda en la carpeta temática, en inglés si es texto original de claude-mem.
- Añadir una fila en `CATALOG.md`.
- Un tema = un archivo. Enlazar; no duplicar.
