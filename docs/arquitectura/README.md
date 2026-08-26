# Arquitectura

Cómo está **hecho** el motor (`src/`). Síntesis en español: [`../start/panorama.md`](../start/panorama.md) y [`../start/compresion.md`](../start/compresion.md).

Lee **un** archivo de esta lista según la pieza, no el directorio entero.

| Archivo | Tema |
|---|---|
| [overview.mdx](./overview.mdx) | Componentes y data flow |
| [overview-layers.md](./overview-layers.md) | Capas hooks → worker → storage |
| [hooks-lifecycle.mdx](./hooks-lifecycle.mdx) | Ciclo captura → compresión |
| [hooks.mdx](./hooks.mdx) | Hooks de Claude Code (referencia; Cursor es otra superficie) |
| [database.mdx](./database.mdx) | SQLite + FTS5 |
| [search.mdx](./search.mdx) | Búsqueda híbrida + Chroma |
| [worker-service.mdx](./worker-service.mdx) | Worker HTTP |
| [session-id.md](./session-id.md) | Identidad de sesión |
| [api.md](./api.md) | API del worker |
| [adapters.md](./adapters.md) | Adapters de plataforma |
| [cloud-sync.mdx](./cloud-sync.mdx) | Spec de sync (antes: [`../start/cloud-sync.md`](../start/cloud-sync.md)) |
| [agent-sdk-v2-preview.md](./agent-sdk-v2-preview.md) | SDK del observer |

Mapa: [`../README.md`](../README.md).
