# Documentación

Todo el conocimiento de **cursor-mem** vive aquí. No hay otra carpeta de docs (`MVP/` ya no existe).

```
docs/README.md     ← empieza aquí (este archivo)
docs/CATALOG.md    ← tabla “si necesitas X, lee Y”
docs/AGENTS.md     ← protocolo corto para agentes
docs/start/        ← español, corto, este repo
docs/filosofia/    ← profundidad (principios de claude-mem)
docs/arquitectura/ ← profundidad (motor)
docs/cursor/       ← superficie Cursor / puente actual
docs/observer/     ← proveedor, settings, búsqueda
```

## Capas

| Capa | Dónde | Idioma | Para qué |
|---|---|---|---|
| **Mapa** | este README + `CATALOG.md` | es | Orientarse; no leer el resto a ciegas |
| **Start** | `start/` | es | Tesis, pipeline, compresión, observer, sync |
| **Referencia** | las otras cuatro carpetas | en (original) | Detalle cuando start no basta |

`start/` **sintetiza**. La referencia **no se reescribe**: son los docs de claude-mem que aún sirven. Si chocan, gana `start/` (intención de este repo) y la referencia es el “cómo está hecho el motor hoy”.

## Humano — orden de lectura

1. [`start/tesis.md`](./start/tesis.md) — por qué existe este repo
2. [`start/panorama.md`](./start/panorama.md) — qué hay en el código y el pipeline
3. [`start/compresion.md`](./start/compresion.md) — cómo se fabrican recuerdos
4. Según el trabajo:
   - Cursor / inyección → [`cursor/README.md`](./cursor/README.md)
   - Elegir modelo observer → [`start/observer.md`](./start/observer.md)
   - Primera versión (TODO) → [`start/mvp.md`](./start/mvp.md)
   - Arrancar el motor aislado → [`start/runtime.md`](./start/runtime.md)
   - Identidad de sesión Cursor → [`start/identidad.md`](./start/identidad.md)
   - Captura Agent (hooks) → [`start/captura.md`](./start/captura.md)
   - Sync nube → [`start/cloud-sync.md`](./start/cloud-sync.md) (no es el MVP de Cursor)
   - Principios → [`filosofia/README.md`](./filosofia/README.md)

No hace falta leer la referencia entera.

## Agente — protocolo

Instrucciones completas: [`AGENTS.md`](./AGENTS.md).

Reglas mínimas:

1. Lee **este README** y, si hace falta ruteo, **`CATALOG.md`**. No abras toda `docs/`.
2. Dirección de producto → `start/tesis.md`. Cómo funciona el motor en 1 página → `start/panorama.md` + `start/compresion.md`.
3. Antes de editar código, abre el doc de start **y** como máximo **un** doc de referencia de esa pieza (ver CATALOG).
4. Cita paths de `src/`; no copies transcripciones de claude-mem.ai ni docs borrados (`docs/public`, `workers/`, `MVP/`).

## Código que acompaña a estos docs

| Path | Rol |
|---|---|
| `src/` | Motor (worker, observer, SQLite, búsqueda) |
| `plugin/modes/` | Personalidad del observer |
| `cursor-hooks/` | Scripts del puente Cursor (prosa en `docs/cursor/`) |
| `tests/` | Tests del motor |

Runtime local: `~/.claude-mem/` (settings, sqlite, chroma). Puerto worker: `37700 + (uid % 100)`.
