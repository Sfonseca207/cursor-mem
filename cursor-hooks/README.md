# Cursor hooks

Puente actual entre los hooks de Cursor y el worker de memoria.

Documentación: [`docs/cursor/README.md`](../docs/cursor/README.md). Por qué replantear el puente: [`docs/start/tesis.md`](../docs/start/tesis.md).

Scripts:

| Hook Cursor | Script | Para qué |
|---|---|---|
| `beforeSubmitPrompt` | `session-init.sh` | Abrir sesión |
| `beforeSubmitPrompt` | `context-inject.sh` | Worker + rules file |
| `afterMCPExecution` / `afterShellExecution` | `save-observation.sh` | Capturar tools |
| `afterFileEdit` | `save-file-edit.sh` | Capturar edits |
| `stop` | `session-summary.sh` | Summary + actualizar contexto |
