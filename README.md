# cursor-mem

Código de referencia tomado de [claude-mem](https://github.com/thedotmack/claude-mem) para extraer sus **filosofías de memoria persistente** y aplicarlas a Cursor (chats del agente y del IDE).

Cursor no recuerda entre conversaciones. Este repo no es un fork de marketing ni el plugin de Claude Code: es el motor y las ideas, recortados.

**Documentación (centralizada):** [`docs/README.md`](docs/README.md)

- Tesis: [`docs/start/tesis.md`](docs/start/tesis.md)
- Motor: `src/`
- Worker aislado: [`docs/start/runtime.md`](docs/start/runtime.md) (`npm run cursormem:install`; Agent / `agent` arranca el worker)
- Uso v1: [`docs/start/uso.md`](docs/start/uso.md) (`cursormem:install` → `~/.cursor/`)
- Captura Agent: [`docs/start/captura.md`](docs/start/captura.md) (`~/.cursor/hooks.json`)
- Inyección: [`docs/start/inyeccion.md`](docs/start/inyeccion.md) (índice `sessionStart` + MCP)
- Puente legado: `cursor-hooks/` (no es el path vivo)

Licencia original: Apache 2.0 (`LICENSE`).
