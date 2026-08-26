# Captura Agent

Los hooks de **usuario** mandan tool use del Agent al worker aislado, en cualquier workspace. Inyección del índice: [`inyeccion.md`](./inyeccion.md). Instalar: [`uso.md`](./uso.md).

Destino v1: `~/.cursor/hooks.json` (un comando: `npm run cursormem:install`). Cursor carga hooks de usuario en todos los proyectos. `cursor-hooks/hooks.json` no es el path vivo (apunta a `.sh` que no existen). Este checkout **no** tiene `.cursor/hooks.json` de proyecto: si existiera junto al de usuario, Cursor dispararía dos veces.

| Evento Cursor | Comando | Worker |
|---|---|---|
| `sessionStart` | `ensure-start` | arranca el worker `:37850` si no está (idempotente) |
| `sessionStart` | `context` | `GET /api/context/inject` → `additional_context` |
| `beforeSubmitPrompt` | `session-init` | `POST /api/sessions/init` (también levanta el worker si hace falta) |
| `postToolUse` | `observation` | `POST /api/sessions/observations` (Read, Grep, Edit, …) |
| `afterShellExecution` | `observation` | `POST /api/sessions/observations` (`Bash`) |
| `afterMCPExecution` | `observation` | `POST /api/sessions/observations` |
| `afterFileEdit` | `file-edit` | `POST /api/sessions/observations` (`write_file`) |
| `stop` | `summarize` | `POST /api/sessions/summarize` (sin transcript: solo observaciones) |

Cada comando es `~/.cursor/hooks/cursor-mem-<evento>.sh` (path relativo al `hooks.json` de usuario, forma que Cursor documenta). El wrapper llama `bash <checkout>/scripts/cursor-mem-hook.sh <evento>`, localiza `bun`, fija el env aislado (`~/.cursor-mem`, puerto `37850`) y **siempre** sale 0 con `{"continue":true}` si algo falla. El CLI del hook corre el TypeScript de este checkout (`src/services/worker-service.ts`), no el bundle marketplace.

No hay `failClosed`, ni matcher, ni Tab, ni segundo hook `context` en `beforeSubmitPrompt`. Timeouts: 45 s `ensure-start` (arranque en frío), 15 s init/context, 10 s el resto. `stop` lleva `loop_limit: 0`. `postToolUse` cubre Read/Grep/Edit; shell/MCP/edits siguen en sus eventos.

Al abrir Agent o `agent` en la terminal, `sessionStart` → `ensure-start` levanta el worker. Si el arranque falla, Cursor sigue (fail-open) y no se guarda memoria. `cursormem:start` queda como atajo opcional.

No uses `npm run cursor:install`: apunta al marketplace y escribe un `.mdc` `alwaysApply` con el pasado.

Identidad: [`identidad.md`](./identidad.md). Runtime: [`runtime.md`](./runtime.md). Prueba: `npm run cursormem:qa` (paso captura + install).

## Estado

**Hecho y probado** (captura HTTP 2026-08-25; path vivo usuario 2026-08-26; autoarranque 2026-08-26): `cursormem:install` escribe `ensure-start` + captura en `~/.cursor/hooks.json`. QA `ensure-start` levanta `:37850` tras un stop. Confirmar en Settings → Hooks que disparan y no bloquean.
