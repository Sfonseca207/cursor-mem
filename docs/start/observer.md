# Cómo se selecciona el observer

El observer **no** es el agente que programa. Es un generador paralelo (una sesión SDK/HTTP por `sessionDbId`) que solo ve XML de tool use y responde XML.

No se elige por cada herramienta. Tú fijas proveedor y modelo; el worker aplica reglas al **arrancar** cada generador.

Código clave:

- Selección: `SessionRoutes.getSelectedProvider()` / `ensureGeneratorRunning()` / `applyTierRouting()`
- Defaults: `src/shared/SettingsDefaultsManager.ts`
- Claude: `src/services/worker/ClaudeProvider.ts` (`modelOverride || getModelId()`)
- Gemini / OpenRouter: `GeminiProvider.ts`, `OpenRouterProvider.ts`
- Modos: `src/services/domain/ModeManager.ts` + `plugin/modes/*.json`
- Aliases `$TIER:*`: `src/services/worker/model-aliases.ts`

## 1. Proveedor

Setting: `CLAUDE_MEM_PROVIDER` = `claude` | `gemini` | `openrouter`  
Default: `claude`  
Origen: `npx claude-mem install`, viewer, o `~/.claude-mem/settings.json`. Env pisa el archivo.

Al iniciar el generador:

1. Si provider = `openrouter` **y** hay API key → OpenRouter
2. Si provider = `gemini` **y** hay API key → Gemini
3. Resto → **Claude**

Gemini/OpenRouter sin key caen a Claude en silencio. Claude elegido pero CLI no listo (`setup_required`) → **no arranca**, no cambia de proveedor.

**cmem Pro no es un 4º proveedor.** El installer escribe `openrouter` con otra `CLAUDE_MEM_OPENROUTER_BASE_URL`, modelo y key `cm_pro_`.

Cambio a mitad de sesión: el generador actual termina; el siguiente usa el nuevo proveedor y conserva `conversationHistory`.

**No hay fallback automático si la API falla** (cuota, auth, red). El mensaje queda pending y se reintenta con el mismo proveedor.

## 2. Modelo

| Proveedor | Setting | Default |
|---|---|---|
| Claude | `CLAUDE_MEM_MODEL` | `claude-haiku-4-5-20251001` |
| Gemini | `CLAUDE_MEM_GEMINI_MODEL` | `gemini-flash-latest` |
| OpenRouter | `CLAUDE_MEM_OPENROUTER_MODEL` | `xiaomi/mimo-v2-flash:free` |

Auth Claude: `CLAUDE_MEM_CLAUDE_AUTH_METHOD` = `subscription` (default, login de Claude Code), `api-key` o `gateway`.

### Tier routing (solo Claude, on por default)

`CLAUDE_MEM_TIER_ROUTING_ENABLED`. Mira la cola pendiente al arrancar el generador:

| Cola | Modelo |
|---|---|
| Solo tools simples: `Read`, `Glob`, `Grep`, `LS`, `ListMcpResourcesTool` | `CLAUDE_MEM_TIER_SIMPLE_MODEL` (`haiku`) |
| Hay `summarize` y está definido summary model | `CLAUDE_MEM_TIER_SUMMARY_MODEL` |
| Mezcla / Edit / Bash / etc. | `CLAUDE_MEM_MODEL` |

Aliases portables en `CLAUDE_MEM_MODEL` (se resuelven en la llamada, sin reiniciar worker):

- `$TIER:fast` → `CLAUDE_MEM_TIER_FAST_MODEL` o `haiku`
- `$TIER:smart` → `CLAUDE_MEM_TIER_SMART_MODEL` o `sonnet`
- `$TIER:simple` → `CLAUDE_MEM_TIER_SIMPLE_MODEL` o `haiku`
- `$TIER:summary` → `CLAUDE_MEM_TIER_SUMMARY_MODEL` o el modelo default

Gemini y OpenRouter **no** usan este routing: un modelo fijo.

## 3. Modo (personalidad, no el LLM)

`CLAUDE_MEM_MODE` default `code`. Carga `plugin/modes/{id}.json` o `~/.claude-mem/modes/`. Define prompts, tipos de observación y conceptos.

Herencia de un nivel: `parent--override` (ej. `code--es`). Si el archivo no existe, fallback a `code`.

El modo no elige Haiku vs Gemini. Elige *qué* se considera un `bugfix` y cómo se redacta la narrativa.

## Cómo cambiarlo

Editar settings y guardar. El siguiente generador usa la nueva config. No hace falta reinstalar ni (en caliente) reiniciar el worker para el proveedor: se lee al arrancar el generador.

Ejemplo Gemini:

```json
{
  "CLAUDE_MEM_PROVIDER": "gemini",
  "CLAUDE_MEM_GEMINI_MODEL": "gemini-flash-latest"
}
```

Ejemplo Claude con Haiku en lecturas y Sonnet en el resto:

```json
{
  "CLAUDE_MEM_PROVIDER": "claude",
  "CLAUDE_MEM_MODEL": "claude-sonnet-4-5",
  "CLAUDE_MEM_TIER_ROUTING_ENABLED": "true",
  "CLAUDE_MEM_TIER_SIMPLE_MODEL": "haiku"
}
```

Settings completos: [`../observer/configuration.mdx`](../observer/configuration.mdx). Esta capa: [`README.md`](./README.md).
