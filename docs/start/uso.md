# Uso v1 (Cursor Agent)

Memoria entre chats del **Agent** en cualquier workspace, contra el worker aislado de **este checkout**. No es el plugin marketplace de claude-mem.

## Arranque

Requisito: [bun](https://bun.sh).

```bash
npm run cursormem:install    # hooks + MCP + wrapper de `agent`
source ~/.cursor-mem/shellenv.sh   # o abre una terminal nueva
agent                          # imprime cursor-mem started + http://localhost:37850
```

El splash de Cursor CLI **no** muestra hooks. El wrapper en `~/.cursor-mem/bin/agent` (primero en PATH) imprime el banner y luego ejecuta el CLI real.

```bash
npm run cursormem:agent          # lo mismo desde este repo, sin wrapper de PATH
npm run cursormem:start          # opcional: worker ya arriba
npm run cursormem:status
npm run cursormem:hooks-status
npm run cursormem:qa
npm run cursormem:stop
```

No uses `npm run cursor:install`, `worker:start` ni `build-and-sync`: apuntan al marketplace y escriben `claude-mem-context.mdc`.

## Dónde mirar

| Qué | Dónde |
|---|---|
| Hooks | Cursor Settings → Hooks. `sessionStart` tiene `ensure-start` + `context`; no deben bloquear el agente. |
| MCP | Server **`cursor-mem`**. No uses `plugin-claude-mem-mcp-search` (marketplace → `~/.claude-mem`). |
| Health | `http://127.0.0.1:37850/api/health` |
| Viewer | `http://localhost:37850/` (el `sessionStart` de `agent` muestra este enlace) |
| SQLite | `~/.cursor-mem/claude-mem.db` |
| Settings | `~/.cursor-mem/settings.json` |

`workerPath` en health debe ser `plugin/scripts/worker-service.cjs` de este checkout, no `marketplaces/thedotmack`.

Si el worker está caído, Cursor **sigue** (hooks fail-open). El siguiente `sessionStart` intenta levantarlo; si eso también falla, no se guarda memoria.

## Path vivo

Usuario, no proyecto:

- `~/.cursor/hooks.json` — `./hooks/cursor-mem-<evento>.sh` (relativo a `~/.cursor/`; no el plugin marketplace)
- `~/.cursor/hooks/cursor-mem-*.sh` — trampolín a este checkout (`:37850`, `~/.cursor-mem`)
- `~/.cursor/mcp.json` — server `cursor-mem` con env `CLAUDE_MEM_DATA_DIR`, puerto `37850`, worker de este checkout
- `~/.cursor/rules/cursor-mem.mdc` — cómo usar `search` / `timeline` / `get_observations`; **cero** historial

Este repo **no** lleva `.cursor/hooks.json` ni `.cursor/mcp.json` (evitar doble disparo con el de usuario). Sí queda [`.cursor/rules/cursor-mem.mdc`](../../.cursor/rules/cursor-mem.mdc) (instrucciones, no dump).

## Prueba de oro (punto 6)

1. Settings → Hooks: los eventos disparan y no bloquean. `sessionStart` incluye `ensure-start` (arranca el worker) y `context` (índice).
2. **Sesión A** (`agent` o Agent del IDE): una decisión o un fix. Observaciones en SQLite / viewer con `platformSource=cursor` y `project` = basename del cwd. El worker no tiene que estar arriba de antemano.
3. **Sesión B** (nuevo `agent`, mismo repo): el índice de `sessionStart` o MCP `search` del server `cursor-mem` (`platformSource=cursor`) encuentra esa observación. No relee 30k tokens. No uses el MCP marketplace.
4. `npm run cursormem:stop` (o `cursormem:qa -- --fail-open`): el agente sigue respondiendo. El *siguiente* `agent` vuelve a levantar el worker.
5. No existe `claude-mem-context.mdc` en `~/.cursor/rules/` ni en `.cursor/rules/` de este repo.

Captura: [`captura.md`](./captura.md). Inyección: [`inyeccion.md`](./inyeccion.md). Runtime: [`runtime.md`](./runtime.md). Corte: [`mvp.md`](./mvp.md).
