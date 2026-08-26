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

Contrato: [`captura.md`](./captura.md). Destino v1: `~/.cursor/hooks.json` (`cursormem:install`, punto 5). Este checkout no lleva hooks de proyecto (doble disparo).

- [x] `~/.cursor/hooks.json` llama `./hooks/cursor-mem-<evento>.sh` (relativo a `~/.cursor/`; runtime aislado, no marketplace).
- [x] `sessionStart` → `ensure-start` (arranca worker si hace falta) y luego `context` (índice).
- [x] `beforeSubmitPrompt` → `session-init` (timeout 15 s; también levanta el worker).
- [x] `afterShellExecution` + `afterMCPExecution` → `observation`.
- [x] `afterFileEdit` → `file-edit`.
- [x] `stop` → `summarize` **solo con observaciones** (Cursor no da transcript).
- [x] QA HTTP: `cursormem:qa` paso captura — `continue: true`; log `ENQUEUED` Bash/search/write_file/summarize.
- [ ] Confirmar en Settings → Hooks que disparan y no bloquean (manual; checklist en [`uso.md`](./uso.md)).
- [x] QA lazy-start: stop + hook `ensure-start` → health `ok` en `:37850`.

### 4. Inyección (índice, no dump) — **hecho y probado** (2026-08-26)

Contrato: [`inyeccion.md`](./inyeccion.md). Destino v1: `~/.cursor/mcp.json` + `sessionStart` (`cursormem:install`, punto 5).

- [x] **No** escribir un rules file always-on con el pasado entero (nada de `claude-mem-context.mdc`).
- [x] MCP de memoria en Cursor: `~/.cursor/mcp.json` → `plugin/scripts/mcp-server.cjs` de este checkout con env aislado (`~/.cursor-mem`, `37850`).
- [x] Índice barato al arrancar: `sessionStart` → `hook cursor context` → `additional_context`. Rule **corta** (cómo usar `search` / `timeline` / `get_observations`), no el historial.
- [x] El agente de la sesión B usa MCP; no relee 30k tokens de recuerdos.
- [x] QA HTTP: `cursormem:qa` paso inject — GET `/api/context/inject` + hook `context` con `additional_context`.

### 5. Instalar en un paso — **hecho y probado** (2026-08-26)

Contrato: [`uso.md`](./uso.md). Destino v1: **usuario** (`~/.cursor/`). No se tocó `CursorHooksInstaller` ni `npm run cursor:install` (marketplace + dump).

- [x] Un comando de este repo: `npm run cursormem:install` escribe hooks + MCP + rule corta contra este checkout (`scripts/cursor-mem-install.ts`).
- [x] README de uso v1: bun, settings, worker, restart Cursor, Hooks tab, viewer `:37850`, SQLite.
- [x] Destino elegido: `~/.cursor/hooks.json` + `~/.cursor/mcp.json` (paths absolutos). Este checkout no lleva copies de proyecto.

### 6. Verificar

Checklist: [`uso.md`](./uso.md). La prueba de oro del punto 0 es el mismo A→B.

- [ ] Chat A: una decisión o un fix; aparecen observaciones en SQLite / viewer. (manual, tras restart Cursor)
- [ ] Chat B (nuevo): índice o `search` (server `cursor-mem`, `platformSource=cursor`) encuentra esa observación.
- [ ] Worker down: el agente igual responde (`cursormem:qa -- --fail-open` cubre health; confirmar el Agent a mano).
- [x] Nada de `claude-mem-context.mdc` alwaysApply en el flujo v1 (`~/.cursor/rules/` y `.cursor/rules/` de este repo).

---

## v1.1 (después, no bloquea)

- Chat IDE / Tab (`afterTabFileEdit`, etc.) con el mismo store y `platformSource` distinto o el mismo `cursor` + tipo de superficie.
- Usar `sessionStart` / `preCompact` en serio.
- Summary de más calidad sin transcript.
- Distinguir qué chats heredan memoria de ingeniería y cuáles no.

## Nunca en el MVP

Cloud sync, Docker, marketplace Claude Code, OpenClaw, reescribir storage.
