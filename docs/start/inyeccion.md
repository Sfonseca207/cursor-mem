# Inyección (índice, no dump)

Un chat Agent **nuevo** no recibe el pasado entero. Recibe un **índice** barato al arrancar y despliega recuerdos con MCP. Instalar: [`uso.md`](./uso.md).

| Pieza | Qué hace | Dónde |
|---|---|---|
| `sessionStart` | `ensure-start` (worker) + `GET /api/context/inject?platformSource=cursor` → `additional_context` | `~/.cursor/hooks.json` |
| MCP | `search` → `timeline` → `get_observations` contra `:37850` | `~/.cursor/mcp.json` (server `cursor-mem`) |
| Rule corta | Cómo usar esas 3 tools; **cero** historial | `~/.cursor/rules/cursor-mem.mdc` |

El adapter Cursor emite `additional_context` **solo** si el handler es `SessionStart` ([`cursor.ts`](../../src/cli/adapters/cursor.ts)). Incluye un banner `cursor-mem started` + `http://localhost:37850` y el índice. El mismo banner va en `user_message` para que `agent` en la terminal lo muestre (como el SessionStart de Claude Code). `beforeSubmitPrompt` sigue siendo solo `session-init`: no inyecta.

`sessionStart` es fire-and-forget: el índice puede no llegar al primer turno (sobre todo si el worker acaba de arrancar). La rule corta cubre esa carrera. El agente B usa MCP, no 30k tokens de recuerdos.

No hay `.cursor/rules/claude-mem-context.mdc`. No uses `npm run cursor:install` ni `full=true`. Este checkout no lleva `.cursor/mcp.json` de proyecto (el de usuario cubre todos los workspaces, incluido este).

Si el worker estaba caído, `sessionStart` lo levanta. Si el arranque falla, el hook no bloquea (índice vacío).

Si el plugin marketplace de claude-mem también inyecta, puedes ver **dos** índices. El de este checkout filtra `platformSource=cursor`. Usa las tools del server **`cursor-mem`**, no `plugin-claude-mem-mcp-search`.

Captura: [`captura.md`](./captura.md). Runtime: [`runtime.md`](./runtime.md). Prueba: `npm run cursormem:qa` (paso inject + install).

## Estado

**Hecho y probado** (HTTP 2026-08-26; banner CLI 2026-08-26): `hook cursor context` emite `additional_context` (índice + `cursor-mem started` + `http://localhost:37850`) y `user_message` (timeline + el mismo enlace) para `agent`.
