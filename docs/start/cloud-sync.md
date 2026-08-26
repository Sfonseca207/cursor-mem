# Cloud sync (cmem.ai Pro)

Replica la memoria local entre dispositivos. **No hay demonio aparte**: el mismo worker que guarda observaciones las sube. Se activa solo si los tres valores de **cmem.ai → Connect** están rellenos:

- `CLAUDE_MEM_CLOUD_SYNC_TOKEN`
- `CLAUDE_MEM_CLOUD_SYNC_USER_ID`
- `CLAUDE_MEM_CLOUD_SYNC_HUB_URL` (https absoluto del SyncHub, no la API de la app)

Vaciar cualquiera apaga el sync. No hay flag extra de enable.

**Privacidad:** sube narrativas de observaciones y el **texto completo de los prompts** a la cuenta cmem.ai. No activarlo si eso debe quedarse en disco.

Código clave:

- Push: `src/services/sync/CloudSync.ts`
- Pull: `src/services/sync/SyncClient.ts`
- Apply: `src/services/sync/SyncApply.ts`
- Spec larga: [`../arquitectura/cloud-sync.mdx`](../arquitectura/cloud-sync.mdx)

El deploy Cloudflare (`workers/sync-hub/`) **se eliminó** de este repo; el cliente en `src/services/sync/` sigue. Skill `/cloud-sync`: no imprimir el token.

## Qué se replica

- Observaciones comprimidas
- Summaries de sesión
- Prompts de usuario (tope 200 KB por campo)
- Mutaciones: título de sesión, reenlace prompt→sesión, remap de proyecto

No migra el corpus local **anterior** al lanzamiento de SyncHub. Solo lo escrito después de conectar.

## Dos carriles, una verdad

HTTP es la fuente de verdad: un log ordenado por usuario en SyncHub (Cloudflare Worker). El WebSocket es solo capa de velocidad.

### Push

La base es la cola: `synced_at IS NULL` = pendiente.

- Debounce ~1.5 s tras la última escritura (250 ms si hay WebSocket)
- Lotes hasta 500 ops / 4 MB; cada body canónico ≤ 256 KB
- Timeout 30 s
- Fallo → la fila sigue `NULL`, retry con backoff 30 s → 10 min
- **Nunca bloquea** el write path local
- El hub deduplica por identidad de origen (retry ≠ duplicado)
- Stamp solo si el `sync_rev` actual coincide con el ack (mutación en vuelo se re-empuja)

### Pull

Cada dispositivo guarda un cursor en el log.

- Al arrancar sesión: pull inmediato (máx. 1.5 s para no congelar el chat)
- Sesión activa: poll cada 30 s
- Idle: cada 5 min
- 1 h sin actividad: se suspende (y se tira el socket)
- Filas remotas entran por el mismo camino que las locales (FTS + Chroma) y se marcan para no re-subirlas
- Cada push también reporta el `head_seq` del log → pull inmediato si hay trabajo remoto

### WebSocket (default on)

`CLAUDE_MEM_CLOUD_SYNC_WS`. Estrictamente advisory: si hay hueco, parse error o drop, cierra y hace un pull HTTP. Cero pérdida de datos. El hub puede forzar `X-Sync-Mode: poll` (más lento, nunca parado).

## Identidad y límites

- `CLAUDE_MEM_CLOUD_SYNC_DEVICE_ID`: UUID persistido al primer arranque. No editarlo.
- `CLAUDE_MEM_CLOUD_SYNC_DEVICE_NAME`: hostname por default.
- Máximo **64** device ids por cuenta (`409 device_limit_exceeded` en uno nuevo).

Status local (siempre registrado, incluso sin configurar):

```bash
curl -s "http://127.0.0.1:${CLAUDE_MEM_WORKER_PORT}/api/sync/status"
```

Configurado + sano: `configured: true`, `hub.reachable: true`, `lastError: null`. Un pending en 0 **no** prueba conectividad: el status siempre hace un `GET /v1/sync/status` autenticado de solo lectura contra el Hub.
