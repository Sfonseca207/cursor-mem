# Identidad Cursor

Una fila de memoria no es “un proceso CLI”. Es **una conversación de Cursor**, etiquetada para no mezclarse con Claude Code.

Identidad en SQLite: `(platform_source, content_session_id)` — [`createSDKSession`](../../src/services/sqlite/SessionStore.ts).

| Campo | Qué es | De dónde |
|---|---|---|
| `contentSessionId` | La conversación | `conversation_id`; si falta, `generation_id`; si falta, `id` |
| `platformSource` | Origen `cursor` | argv `hook cursor`, **no** el JSON del hook |
| `project` | Nombre del repo | `workspace_roots[0]` o `cwd` → basename del git root |

Código: [`src/cli/adapters/cursor.ts`](../../src/cli/adapters/cursor.ts), [`src/cli/hook-command.ts`](../../src/cli/hook-command.ts) (`input.platform = platform`), [`src/cli/handlers/session-init.ts`](../../src/cli/handlers/session-init.ts).

Sin ningún id: el handler omite (`continue: true`). Vacío `conversation_id` cae a `generation_id` (tests en `tests/hook-lifecycle.test.ts`).

`memorySessionId` es del **observer**, no de Cursor. Detalle Claude Code: [`../arquitectura/session-id.md`](../arquitectura/session-id.md). Init con `platformSource=cursor` no arranca el SDK observer.

Captura (hooks usuario): [`captura.md`](./captura.md). Uso: [`uso.md`](./uso.md). Prueba: `npm run cursormem:qa` (pasos identidad + captura). Runtime: [`runtime.md`](./runtime.md).

## Estado

**Hecho y probado** (2026-08-25): hook `cursor session-init` crea fila `(cursor, conversation_id)` con `project=cursor-mem`; el mismo id con `claude` es otra fila; sin id no inserta.
