# Compresión

El agente que programa **no** guarda transcripciones crudas. Un segundo modelo, el **observer**, mira cada herramienta que usó y la convierte en una observación corta y estructurada.

## Flujo

```
PostToolUse / session-init / Stop
        ↓
  Worker HTTP (ingest, no espera)
        ↓
  Cola por sessionDbId
        ↓
  Prompt XML al observer (init | ingest | summarize)
        ↓
  Respuesta XML → parseAgentXml
        ↓
  SQLite + Chroma
```

El hook tiene timeout corto (~2 s) y **no espera** a la IA. La compresión es asíncrona (típicamente 5–30 s). Ratio típico tokens_entrada ÷ tokens_salida: ~10–14×.

Código clave:

- Ingesta: `src/services/worker/http/shared.ts` (`ingestObservation`)
- Cola: `src/services/worker/SessionManager.ts`
- Prompts: `src/sdk/prompts.ts`
- Parseo: `src/sdk/parser.ts`
- Persistencia: `src/services/worker/agents/ResponseProcessor.ts`

## Tres disparadores

| Fuente | Cuándo | Prompt |
|---|---|---|
| `init` | Primer prompt del usuario (`session-init`) | identidad + request + esqueleto XML |
| `ingest` | Cada tool use (`PostToolUse`) | `<observed_from_primary_session>` con herramienta, hora, cwd, parámetros, resultado |
| `summarize` | Fin de sesión (`Stop`) | `<summary>` (request, investigated, learned, completed, next_steps, notes) |

Mezclar `<observation>` en un summarize se descarta. El observer **no tiene herramientas**: solo lee XML y responde XML. Si el tool use no aporta nada, responde vacío y se tira.

## Recorte de input

Campos `parameters` / `outcome` se recortan a **16k caracteres** (cabeza 60% + cola 30%) con un marcador `<elided …>`. Evita que un Read enorme reviente la ventana del observer.

Filtros antes de encolar:

- proyectos en `CLAUDE_MEM_EXCLUDED_PROJECTS`
- herramientas en `CLAUDE_MEM_SKIP_TOOLS` (default: ListMcpResourcesTool, SlashCommand, Skill, TodoWrite, AskUserQuestion)
- tags `<private>`
- payloads internos de protocolo

## Forma de una observación (modo `code`)

Tipos: `bugfix`, `feature`, `refactor`, `change`, `discovery`, `decision`, `security_alert`, `sensitive`, …

Campos XML:

- `type`, `title`, `subtitle`
- `facts` — hechos concretos
- `narrative` — qué pasó y por qué importa
- `concepts` — etiquetas (se recortan en el primer `:`; el tipo de observación no puede ser concept)
- `files_read` / `files_modified` — el worker también los infiere de Read/Edit/Write/apply_patch

El título corto (~10 palabras) es lo que se inyecta barato en la siguiente sesión (progressive disclosure).

## Salida inválida

Si el modelo devuelve prosa, XML roto o error de cuota/auth:

- se clasifica (`xml` / `idle` / `prose`)
- no se guarda basura
- cuota → se pausa el generador y se conserva el batch
- no hay cambio automático de proveedor

## Privacidad local vs red

La base, el índice y los logs se quedan en `~/.claude-mem`. Las **únicas** llamadas de red obligatorias son al proveedor configurado para comprimir (Claude / Gemini / OpenRouter). Cloud sync es otro canal, opcional: [cloud-sync.md](./cloud-sync.md).

Profundidad: [`../arquitectura/hooks-lifecycle.mdx`](../arquitectura/hooks-lifecycle.mdx). Índice de esta capa: [`README.md`](./README.md).
