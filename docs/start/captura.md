# Captura Agent

Los hooks de **este checkout** mandan tool use del Agent al worker aislado. No inyectan contexto (punto 4) ni se instalan en todos los repos (punto 5).

Destino v1: [`.cursor/hooks.json`](../../.cursor/hooks.json). Cursor lo carga al abrir este proyecto. `cursor-hooks/hooks.json` no es el path vivo (apunta a `.sh` que no existen).

| Evento Cursor | Comando | Worker |
|---|---|---|
| `beforeSubmitPrompt` | `session-init` | `POST /api/sessions/init` |
| `afterShellExecution` | `observation` | `POST /api/sessions/observations` (`Bash`) |
| `afterMCPExecution` | `observation` | `POST /api/sessions/observations` |
| `afterFileEdit` | `file-edit` | `POST /api/sessions/observations` (`write_file`) |
| `stop` | `summarize` | `POST /api/sessions/summarize` (sin transcript: solo observaciones) |

Cada comando es `bash scripts/cursor-mem-hook.sh <evento>`. El wrapper localiza `bun`, fija el env aislado (`~/.cursor-mem`, puerto `37850`) y **siempre** sale 0 con `{"continue":true}` si algo falla. El CLI del hook corre el TypeScript de este checkout (`src/services/worker-service.ts`), no el bundle marketplace.

No hay `failClosed`, ni matcher, ni Tab, ni segundo hook `context` en `beforeSubmitPrompt`. Timeouts cortos (5 s init, 10 s el resto). `stop` lleva `loop_limit: 0`.

Arranca el worker **antes** de chatear: `npm run cursormem:start`. Si está caído, Cursor sigue (fail-open); no se guarda memoria.

## Otros repos

Este JSON solo cubre **este** proyecto. Para el resto de workspaces hay que instalar en `~/.cursor/hooks.json` (punto 5 del [MVP](./mvp.md)). No uses `npm run cursor:install`: apunta al marketplace y escribe un `.mdc` `alwaysApply`.

Identidad: [`identidad.md`](./identidad.md). Runtime: [`runtime.md`](./runtime.md). Prueba: `npm run cursormem:qa` (paso captura).

## Estado

**Hecho y probado** (2026-08-25): hooks de proyecto cableados; QA `observation` shell/MCP, `file-edit`, `summarize` sin transcript; `continue:true`. Confirmar en Settings → Hooks que disparan y no bloquean.
