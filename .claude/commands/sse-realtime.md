# SSE — Eventos Tempo Real
> Usar quando: SSE stream, broadcast, eventos real-time, useSSE hook

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/lib/sse-manager.ts` | Broadcast SSE server-side (Redis pub/sub + fallback local) |
| `src/lib/redis.ts` | Cliente Redis + factory subscriber (pub/sub) |
| `src/app/api/events/route.ts` | GET: SSE endpoint (TextEventStream) |
| `src/hooks/useSSE.ts` | Hook cliente (auto-reconnect 3s) |

---

## Endpoint

`GET /api/events` — TextEventStream, auto-reconnect 3s no cliente.

---

## Tipos de Evento

| Evento | Payload | Trigger |
|--------|---------|---------|
| `nova_mensagem` | `{ conversa_id, mensagem }` | Webhook recebe msg |
| `conversa_atualizada` | `{ conversa_id, ultima_msg, nao_lida }` | Webhook ou acao usuario |
| `mensagem_status` | `{ conversa_id, mensagem_id, status }` | Webhook status update |
| `mensagem_editada` | `{ conversa_id, mensagem_id, conteudo }` | Edicao de mensagem |
| `mensagem_removida` | `{ conversa_id, mensagem_id }` | Soft-delete |
| `confirmacao_atualizada` | `{ chave_agenda, status }` | Resposta confirmacao |
| `chamada_nova` | `{ chamada }` | AMI Newchannel |
| `chamada_atualizada` | `{ chamada_id, status, duracao }` | AMI BridgeEnter/Hangup |
| `ramal_status` | `{ ramal, status }` | AMI DeviceStateChange |
| `atendente_status` | `{ atendente_id, presenca }` | PATCH /atendentes/status |
| `chat_interno_mensagem` | `{ chat_id, mensagem }` | Nova msg chat interno |
| `chat_interno_reacao` | `{ chat_id, mensagem_id, reacoes }` | Reacao chat interno |

---

## Broadcast Pattern (Server)

```typescript
import { sseManager } from '@/lib/sse-manager';

// Enviar evento
sseManager.broadcast('nova_mensagem', {
  conversa_id: 123,
  mensagem: { ... }
});
```

---

## Hook useSSE (Client)

```typescript
const { lastEvent } = useSSE();

useEffect(() => {
  if (lastEvent?.type === 'nova_mensagem') {
    // processar
  }
}, [lastEvent]);
```

Auto-reconnect em 3s se conexao cair.

---

## Redis Pub/Sub (Multi-Instancia)

O SSE Manager usa Redis pub/sub para permitir multiplas instancias do app (preparacao SaaS):
- `broadcast()` publica no canal `sse:events` via Redis
- Cada instancia tem subscriber que recebe e repassa para clientes locais via `localBroadcast()`
- **Fallback**: Se Redis indisponivel, broadcast vai direto para clientes locais (Map<>)
- Subscriber usa conexao Redis dedicada (pub/sub exige conexao separada)

---

## Regras

1. **Webhooks rapidos** — Retornar 200 OK imediato, processar async, depois broadcast SSE
2. **Reconnect 3s** — Frontend reconecta automaticamente
3. **Todos os dominios usam SSE** — Mensagens, conversas, chamadas, presenca, chat interno, confirmacao
4. **Redis opcional** — SSE funciona sem Redis (broadcast local), mas multi-instancia requer Redis
