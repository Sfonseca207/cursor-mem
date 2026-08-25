# Runtime aislado (este repo)

El worker de **cursor-mem** no comparte disco ni puerto con el plugin claude-mem que ya puedas tener vivo.

| Qué | cursor-mem (este checkout) | claude-mem (producto) |
|---|---|---|
| Datos | `~/.cursor-mem` | `~/.claude-mem` |
| Puerto | `37850` | `37700 + (uid % 100)` |
| Script | `plugin/scripts/worker-service.cjs` de **este** repo | marketplace `thedotmack` |

Variables (el launcher las fija; no hace falta exportarlas a mano):

- `CLAUDE_MEM_DATA_DIR=$HOME/.cursor-mem`
- `CLAUDE_MEM_WORKER_PORT=37850`
- `CLAUDE_MEM_WORKER_SCRIPT_PATH=<repo>/plugin/scripts/worker-service.cjs`

## Comandos

```bash
npm run cursormem:start    # arranca el worker aislado
npm run cursormem:status
npm run cursormem:stop
npm run cursormem:qa       # health + ingest HTTP (one-shot)
npm run cursormem:qa -- --watch
npm run cursormem:qa -- --fail-open
```

No uses `npm run worker:start` ni `build-and-sync`: apuntan a `~/.claude-mem` / marketplace.

Health: `http://127.0.0.1:37850/api/health`  
Readiness: `http://127.0.0.1:37850/api/readiness`

El `workerPath` de health debe ser el `.cjs` de este checkout, no `marketplaces/thedotmack`.

## Fallo abierto

Si este worker está caído, Cursor **sigue**. Los hooks de captura son fail-open (`continue: true` / timeout). `cursormem:qa --fail-open` para el proceso aislado y comprueba que health deja de responder; no toca el worker de claude-mem.

Código: [`scripts/cursor-mem-runtime.ts`](../../scripts/cursor-mem-runtime.ts), [`scripts/cursor-mem-qa.ts`](../../scripts/cursor-mem-qa.ts). Corte: [`mvp.md`](./mvp.md).

## Estado

**Hecho y probado** (2026-08-25): start → `ready` en `:37850`; stop → mensaje `Worker parado…`; `cursormem:qa` ingest HTTP; `--watch`; `--fail-open`. No se tocó `~/.claude-mem`.
