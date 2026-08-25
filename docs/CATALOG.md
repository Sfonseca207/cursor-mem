# Catálogo

Ruteo: una fila por archivo. Lee `docs/README.md` primero. **No** descargues esta tabla entera a memoria de trabajo: busca la fila de la tarea.

Leyenda de capa: `mapa` · `start` · `ref`.

## Mapa

| Path | Capa | Cuándo |
|---|---|---|
| `docs/README.md` | mapa | Siempre primero. Arquitectura de la docs. |
| `docs/AGENTS.md` | mapa | Protocolo de lectura para agentes. |
| `docs/CATALOG.md` | mapa | Esta tabla. |

## Start (español, este repo)

| Path | Cuándo |
|---|---|
| `docs/start/README.md` | Índice de la capa start. |
| `docs/start/tesis.md` | Por qué cursor-mem; qué se copia y qué no; Agent vs IDE. |
| `docs/start/panorama.md` | Pipeline, paths de código, runtime `~/.claude-mem`. |
| `docs/start/compresion.md` | Observer XML, cola, init/ingest/summarize, código en `src/`. |
| `docs/start/observer.md` | Cómo se elige proveedor/modelo/modo. |
| `docs/start/cloud-sync.md` | Sync opcional; no es el MVP Cursor. |
| `docs/start/mvp.md` | TODO de la v1 (Agent usable). |
| `docs/start/runtime.md` | Worker aislado vs claude-mem; `cursormem:start` / `cursormem:qa`. |
| `docs/start/identidad.md` | Contrato: conversation_id, platformSource=cursor, proyecto. |
| `docs/start/captura.md` | Hooks Agent de este checkout; fail-open; `~/.cursor/hooks.json` es punto 5. |

## Filosofía (ref)

| Path | Cuándo |
|---|---|
| `docs/filosofia/README.md` | Índice. Principios, no implementación. |
| `docs/filosofia/progressive-disclosure.mdx` | Índice primero; fetch a demanda. |
| `docs/filosofia/context-engineering.mdx` | Presupuesto de atención / context rot. |
| `docs/filosofia/modes.mdx` | Modo = personalidad del observer. |
| `docs/filosofia/file-read-gate.mdx` | No meter archivos enteros al prompt. |
| `docs/filosofia/platform-integration.mdx` | Cómo un IDE se enchufa al worker. |

## Arquitectura (ref)

| Path | Cuándo |
|---|---|
| `docs/arquitectura/README.md` | Índice del motor. |
| `docs/arquitectura/overview.mdx` | Componentes y data flow. |
| `docs/arquitectura/overview-layers.md` | Capas hooks → worker → storage. |
| `docs/arquitectura/hooks-lifecycle.mdx` | Captura → compresión (ciclo). |
| `docs/arquitectura/hooks.mdx` | Hooks de **Claude Code** (no copiar a Cursor). |
| `docs/arquitectura/database.mdx` | SQLite + FTS5. |
| `docs/arquitectura/search.mdx` | Búsqueda híbrida + Chroma. |
| `docs/arquitectura/worker-service.mdx` | Worker HTTP. |
| `docs/arquitectura/session-id.md` | Identidad de sesión. |
| `docs/arquitectura/api.md` | API del worker. |
| `docs/arquitectura/adapters.md` | Adapters de plataforma. |
| `docs/arquitectura/cloud-sync.mdx` | Spec larga de sync (después de `start/cloud-sync.md`). |
| `docs/arquitectura/agent-sdk-v2-preview.md` | SDK del observer. |

## Cursor (ref + puente)

| Path | Cuándo |
|---|---|
| `docs/cursor/README.md` | Índice; qué está desactualizado. |
| `docs/cursor/hooks-reference.md` | Eventos Agent vs Tab. **Leer si se diseñan hooks.** |
| `docs/cursor/context-injection.md` | Rules file `alwaysApply` (el anti-patrón a reemplazar). |
| `docs/cursor/parity.md` | Claude Code vs Cursor (parcialmente viejo: Cursor ya tiene `sessionStart`). |
| `docs/cursor/index.mdx` | Integración según claude-mem producto. |
| `docs/cursor/bridge-readme.md` | README original del puente. |
| `docs/cursor/integration.md` | Detalle de scripts. |
| `docs/cursor/review.md` | Review de edge cases del puente. |
| `docs/cursor/quickstart.md` | Setup del puente (producto original). |
| `docs/cursor/standalone-setup.md` | Cursor sin Claude Code. |
| `docs/cursor/gemini-setup.mdx` | Gemini en Cursor; detalle de modelo en `observer/`. |
| `docs/cursor/openrouter-setup.mdx` | OpenRouter en Cursor; igual. |

Scripts: `scripts/cursor-mem-hook.sh` (vivo). `cursor-hooks/*.sh` no existen.

## Observer (ref)

| Path | Cuándo |
|---|---|
| `docs/observer/README.md` | Índice. Empieza por `start/observer.md`. |
| `docs/observer/configuration.mdx` | Lista de `CLAUDE_MEM_*`. |
| `docs/observer/private-tags.mdx` | Tags `<private>`. |
| `docs/observer/search-tools.mdx` | MCP `search` → `timeline` → `get_observations`. |
| `docs/observer/gemini-provider.mdx` | Gemini. |
| `docs/observer/openrouter-provider.mdx` | OpenRouter. |
| `docs/observer/security.md` | Notas de seguridad. |
