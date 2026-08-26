# Tesis: memoria para Cursor, filosofía de claude-mem

## El problema

Cursor **no** mantiene memoria entre conversaciones:

- Chats del **agente** (Agent)
- Chats del **IDE** (Chat / Composer)

Cada hilo empieza en blanco. Lo que se decidió ayer, el bug que se arregló, el mapa del repo: hay que volver a explicarlo o redescubrirlo.

## Qué no es este trabajo

No es “instalar claude-mem y listo”, ni portar el plugin de Claude Code línea por línea.

claude-mem es el **código de referencia open source**: un sistema que ya resolvió memoria persistente para agentes. De ahí se toman **filosofías y patrones**, y se aplican a Cursor — al Claude que corre en el agente y en los chats del IDE.

Este repo (`cursor-mem`) es el lugar para ese diseño, no un fork de marketing.

## Filosofías que sí se copian

Vienen de cómo está hecho claude-mem, no de su empaquetado como plugin de Claude Code.

### 1. No guardar transcripciones; guardar recuerdos

El agente que programa produce ruido (Reads enormes, diffs, logs). La memoria es un **observer aparte** que comprime tool use en observaciones estructuradas (tipo, título, hechos, narrativa, archivos). El coding model no se come su propio historial crudo.

### 2. Progressive disclosure (índice primero)

No inyectar 30k tokens de pasado al arrancar. Inyectar un **índice barato** (títulos, tipos, IDs, coste). El agente pide detalle solo de lo relevante (`search` → `timeline` → `get_observations`). Atención es un presupuesto finito (context rot).

### 3. Captura fire-and-forget

Los hooks **nunca bloquean** al agente. Timeout corto, cola asíncrona, si el worker falla el IDE sigue. Memoria es best-effort; el editor no puede romperse por ella.

### 4. Observer ≠ coder

Modelo barato/rápido comprime (Haiku, Flash, free tier). El modelo caro programa. Misma separación de roles aunque el “coder” sea Claude en Cursor.

### 5. Local-first

SQLite + búsqueda (FTS / vectores) en disco. La red es para comprimir y, si se quiere, sync. Privacidad por default (`<private>`, proyectos excluidos, skip de tools ruidosos).

### 6. Ciclo de sesión, no RAG genérico

```
sembrar → inyectar índice → capturar → comprimir → resumir al cerrar → la siguiente sesión hereda
```

La primera sesión de un proyecto siembra. A partir de la segunda, hay continuidad. No es “embebe todo el repo y espera”.

### 7. Fallar abierto y durable

La cola es la base (`NULL` = pendiente), no un proceso frágil en RAM. Retry sin bloquear writes. Si el observer se cae, el trabajo del usuario no se cae.

### 8. Modo = personalidad, no el motor

Tipos de observación y prompts (`code`, `code--es`, …) se cambian sin reescribir captura, storage ni búsqueda.

## Qué no se copia (es de Claude Code, no de la filosofía)

| Pieza de claude-mem | Por qué no es el modelo Cursor |
|---|---|
| `additionalContext` en SessionStart | Cursor no inyecta así; hoy se parchea con un `.mdc` always-on |
| Transcript en el hook `Stop` | Cursor no lo da; el summary tiene que salir de observaciones |
| Claude Agent SDK como runtime del observer | En Cursor el observer puede ser Gemini/OpenRouter/Claude API; el SDK es un proveedor, no el diseño |
| Plugin marketplace / slash commands de Claude Code | Superficie distinta |
| Un solo tipo de “sesión” = un proceso CLI | Cursor tiene **dos superficies** (Agent vs Chat IDE) con hooks distintos |

## Superficies Cursor a cubrir

| Superficie | Qué hay que recordar | Señal de ciclo de vida |
|---|---|---|
| **Agent** | Tools, shell, edits, MCP, decisiones | `sessionStart` / `beforeSubmitPrompt` / `postToolUse` / `afterFileEdit` / `stop` |
| **Chat IDE** | Prompts, lecturas, edits de Tab/Composer | Puede no disparar los mismos agent hooks; hay eventos Tab (`afterTabFileEdit`, etc.) |

Hoy `cursor-hooks/` es un **puente** hacia el worker de claude-mem, no un diseño Cursor-first. Inyecta contexto escribiendo `.cursor/rules/claude-mem-context.mdc` con `alwaysApply: true`: eso contradice progressive disclosure (el índice entra en **todos** los chats, no a demanda) y no distingue Agent vs IDE.

Huecos del puente actual (PARITY.md, en parte desactualizado):

- Summary sin transcript → peor calidad al cerrar
- Cursor ya tiene `sessionStart` / `postToolUse` / `afterAgentResponse` / `preCompact` que el puente casi no usa
- Chat IDE y Agent no están modelados como dos orígenes (`platformSource`) de primera clase
- El rules file always-on ensucia chats que no deberían heredar memoria de ingeniería

## Norte de diseño (cursor-mem)

1. **Misma filosofía de memoria** que claude-mem: observer, observaciones, índice, búsqueda por capas.
2. **Runtime Cursor-native**: hooks del agente y del IDE como fuente de captura; identidad de sesión = conversación Cursor, no un CLI.
3. **Inyección alineada con progressive disclosure**: índice pequeño al arrancar (o skill/MCP para desplegar), no un dump alwaysApply de todo el pasado.
4. **Dos superficies, un store**: Agent y Chat IDE escriben al mismo SQLite/Chroma, etiquetados por origen, para que un chat del IDE pueda heredar lo que hizo el agente anoche (y al revés) cuando tenga sentido.
5. **Reutilizar del código actual** el worker, el parser XML, ModeManager, FTS/Chroma, cola y (si se quiere) SyncHub. No reescribir storage. Sí replantear captura + inyección para Cursor.

## Dónde sigue

Mapa: [`../README.md`](../README.md). Esta capa: [`README.md`](./README.md).

| Doc | Rol |
|---|---|
| [panorama.md](./panorama.md) | Pipeline y árbol de código |
| [compresion.md](./compresion.md) | Observer: se reutiliza |
| [observer.md](./observer.md) | Cómo elegir el modelo que comprime |
| [cloud-sync.md](./cloud-sync.md) | Opcional; no es el MVP de Cursor |
| [`../cursor/README.md`](../cursor/README.md) | Puente actual y hooks del IDE |
