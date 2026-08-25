# Panorama

Síntesis del **motor** que quedó en este repo (código de claude-mem recortado). La dirección de producto está en [tesis.md](./tesis.md).

## Qué es el motor

Sistema de memoria persistente: captura tool use, comprime con un LLM observer, guarda en local, reinyecta un índice en la siguiente sesión.

```
Hook (Read/Edit/Bash/…) → Worker (cola) → Observer LLM → XML parseado → SQLite + Chroma → siguiente sesión
```

1. **Captura** — hooks de ciclo de vida.
2. **Compresión** — ver [compresion.md](./compresion.md).
3. **Almacenamiento** — SQLite (FTS5) + Chroma.
4. **Reinyección** — 1ª sesión siembra; desde la 2ª hay continuidad.
5. **Búsqueda** — `search` → `timeline` → `get_observations` ([`../observer/search-tools.mdx`](../observer/search-tools.mdx)).

Datos en `~/.claude-mem`. Lo único que sale de la máquina por defecto: llamadas al proveedor que comprime. Sync a cmem.ai: [cloud-sync.md](./cloud-sync.md).

## Árbol que importa

| Path | Rol |
|---|---|
| `src/` | Worker, observer, SQLite, búsqueda. Reutilizar. |
| `tests/` | Tests del motor. |
| `plugin/modes/` | Personalidades (`code`, etc.). |
| `cursor-hooks/` | Scripts del puente Cursor (a replantear; [tesis.md](./tesis.md)). |
| `docs/` | Esta documentación. |

Se eliminó el empaquetado de producto: Docker, SyncHub Cloudflare, OpenClaw, installer Vercel, marketplace/CI, i18n Mintlify.

## Runtime

| Qué | Dónde |
|---|---|
| Settings | `~/.claude-mem/settings.json` (env pisa el archivo) |
| Base | `~/.claude-mem/claude-mem.db` |
| Vectores | `~/.claude-mem/chroma/` |
| Modos de usuario | `~/.claude-mem/modes/` |
| Worker | `37700 + (uid % 100)` |

Profundidad: [`../arquitectura/README.md`](../arquitectura/README.md).
