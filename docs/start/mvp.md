# Primera versión (MVP)

Qué hay que hacer para **usar memoria en Cursor Agent** en este repo. No es el producto claude-mem ni las dos superficies a la vez.

**Hecho cuando:** abres un chat nuevo del agente, y el modelo puede recordar (índice + búsqueda) lo que hizo en un chat anterior del mismo proyecto — sin reexplicar.

**Fuera de v1:** sync a cmem.ai, Chat IDE / Tab como origen de primera clase, marketplace, reescribir SQLite/Chroma.

---

## Reutilizar (no rehacer)

| Pieza | Dónde |
|---|---|
| Worker HTTP, cola, observer XML | `src/services/worker/` |
| Init / ingest / summarize | `/api/sessions/init`, observaciones, `/api/sessions/summarize` |
| Índice | `GET /api/context/inject` |
| Búsqueda por capas | MCP `search` → `timeline` → `get_observations` |
| `platformSource=cursor` | ya existe en storage y search |
| Handlers de hook | `src/cli/handlers/` (`session-init`, `observation`, `file-edit`, `summarize`, `context`) |

**Sí hay que replantear:** captura (hooks Cursor) e inyección (nada de `.mdc` `alwaysApply: true`).

---

## TODO

### 0. Corte y prueba de aceptación — **hecho y probado** (2026-08-25)

- [x] v1 = **solo Agent**. Chat IDE / Tab queda para v1.1.
- [ ] Prueba de oro **en Cursor**: sesión A edita/decide algo; sesión B (chat nuevo, mismo repo) recupera eso vía índice o MCP. Espera al punto 4 (inyección).
- [x] Prueba de oro **HTTP**: `npm run cursormem:qa` — health `ok`, `workerPath` de este checkout, init `initialized`, observación `queued`. Puerto claude-mem (`37701`) no se ocupó.
- [x] Fallo abierto: `npm run cursormem:qa -- --fail-open` — health deja de responder en `:37850`.
- [x] `cursormem:start` → JSON `ready`; `cursormem:stop` → `Worker parado en el puerto 37850`.

### 1. Motor usable desde este checkout — **hecho y probado**

Runtime aislado (no marketplace, no `~/.claude-mem`): [`runtime.md`](./runtime.md).

- [x] Arrancar el worker **desde `plugin/scripts/worker-service.cjs` de este repo** (`npm run cursormem:start`). No usar `worker:start` / `build-and-sync`.
- [x] Settings en `~/.cursor-mem/settings.json` (puerto `37850`). Proveedor observer (Gemini/OpenRouter): **después**; health no lo necesita.
- [x] Health: `GET http://127.0.0.1:37850/api/health` y `/api/readiness`.
- [x] Camino marketplace no es requisito (`CLAUDE_MEM_WORKER_SCRIPT_PATH` apunta a este checkout).

### 2. Identidad Cursor — **hecho y probado** (2026-08-25)

Contrato: [`identidad.md`](./identidad.md).

- [x] Sesión = conversación Cursor (`conversation_id` → `contentSessionId`).
- [x] Toda captura de este camino sale con `platformSource=cursor` (argv `hook cursor`).
- [x] Proyecto = cwd / git root basename (`cursor-mem` en este checkout).
- [x] QA: `cursormem:qa` corre `hook cursor session-init`, fila SQLite correcta, mismo UUID + `claude` = otra fila, sin id = no inserta.

### 3. Captura (Agent) — **hecho y probado** (2026-08-25)

Contrato: [`captura.md`](./captura.md). Destino v1: `.cursor/hooks.json` de **este** checkout. Para el resto de repos: `~/.cursor/hooks.json` (punto 5).

- [x] `hooks.json` de proyecto llama `bash scripts/cursor-mem-hook.sh <evento>` (runtime aislado, no marketplace).
- [x] `beforeSubmitPrompt` → `session-init` (timeout 5 s).
- [x] `afterShellExecution` + `afterMCPExecution` → `observation`.
- [x] `afterFileEdit` → `file-edit`.
- [x] `stop` → `summarize` **solo con observaciones** (Cursor no da transcript).
- [x] QA HTTP: `cursormem:qa` paso captura — `continue: true`; log `ENQUEUED` Bash/search/write_file/summarize.
- [ ] Confirmar en Settings → Hooks que disparan y no bloquean (manual, este checkout).
- [ ] (Opcional v1) `sessionStart` / `afterAgentResponse` — no bloquean; inyección es punto 4.

### 4. Inyección (índice, no dump)

Reemplazar `.cursor/rules/claude-mem-context.mdc` con `alwaysApply: true`.

- [ ] **No** escribir un rules file always-on con el pasado entero.
- [ ] Cablear MCP de memoria en Cursor (`plugin/scripts/mcp-server.cjs` o el que resuelva el instalador contra este repo).
- [ ] Índice barato al arrancar **solo si** el hook puede devolver contexto (p. ej. `sessionStart` / `additional_context`). Si Cursor **no** deja inyectar texto al prompt desde el hook: un rule **corto** (cómo usar `search` / `timeline` / `get_observations`), no el historial.
- [ ] El agente de la sesión B usa MCP; no relee 30k tokens de recuerdos.

### 5. Instalar en un paso

- [ ] Un comando de este repo: instalar hooks + MCP contra el checkout (adaptar `CursorHooksInstaller` / `npm run cursor:install` para que no exija marketplace).
- [ ] README de uso v1: bun, settings, worker, restart Cursor, dónde mirar (Hooks tab + viewer si sigue vivo).
- [ ] Destino: `~/.cursor/hooks.json` (user) o `.cursor/hooks.json` (proyecto). Elegir uno para v1 y documentarlo.

### 6. Verificar

- [ ] Chat A: una decisión o un fix; aparecen observaciones en SQLite / viewer.
- [ ] Chat B (nuevo): índice o `search` encuentra esa observación.
- [ ] Worker down: el agente igual responde.
- [ ] Nada de `claude-mem-context.mdc` alwaysApply en el flujo v1.

---

## v1.1 (después, no bloquea)

- Chat IDE / Tab (`afterTabFileEdit`, etc.) con el mismo store y `platformSource` distinto o el mismo `cursor` + tipo de superficie.
- Usar `sessionStart` / `preCompact` en serio.
- Summary de más calidad sin transcript.
- Distinguir qué chats heredan memoria de ingeniería y cuáles no.

## Nunca en el MVP

Cloud sync, Docker, marketplace Claude Code, OpenClaw, reescribir storage.
