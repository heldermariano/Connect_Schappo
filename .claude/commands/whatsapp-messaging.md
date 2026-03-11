# WhatsApp Messaging
> Usar quando: enviar/receber mensagens, midia, audio, templates, reacoes, encaminhamento, webhooks WhatsApp

---

## Numeros WhatsApp

| Numero | Provider | Categoria | Uso |
|--------|----------|-----------|-----|
| 556192894339 | UAZAPI | eeg | EEG (bot N8N) |
| 556183008973 | UAZAPI | recepcao | Recepcao |
| 556133455701 | 360Dialog | geral | Geral + Voz SIP |

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/app/api/webhook/uazapi/route.ts` | Webhook UAZAPI (msg + call) |
| `src/app/api/webhook/360dialog/route.ts` | Webhook 360Dialog (Meta Cloud) |
| `src/app/api/mensagens/send/route.ts` | Enviar texto |
| `src/app/api/mensagens/send-media/route.ts` | Enviar midia (+ ffmpeg audio) |
| `src/app/api/mensagens/send-template/route.ts` | Enviar template Meta 360Dialog |
| `src/app/api/mensagens/forward/route.ts` | Encaminhar mensagem |
| `src/app/api/mensagens/react/route.ts` | Reagir com emoji |
| `src/app/api/mensagens/send-contact/route.ts` | Enviar vCard |
| `src/app/api/mensagens/send-location/route.ts` | Enviar localizacao |
| `src/app/api/mensagens/resend/route.ts` | Reenviar msg com falha |
| `src/app/api/media/[messageId]/route.ts` | Proxy midia multi-provider |
| `src/lib/webhook-parser-uazapi.ts` | Parser UAZAPI → schema atd |
| `src/lib/webhook-parser-360.ts` | Parser 360Dialog → schema atd |
| `src/components/chat/MessageBubble.tsx` | Balao de mensagem |
| `src/components/chat/MediaPreview.tsx` | Preview midia |
| `src/components/chat/AudioRecorder.tsx` | Gravacao audio PTT |
| `src/components/chat/ForwardModal.tsx` | Modal encaminhar |
| `src/components/chat/TemplateSendModal.tsx` | Modal template Meta |
| `src/hooks/useMensagens.ts` | Hook fetch + envio mensagens |

---

## API UAZAPI

### Endpoints de Envio

| Endpoint | Body | Notas |
|----------|------|-------|
| `POST /send/text` | `{ number, text, replyid?, mentions? }` | |
| `POST /send/image` | `{ number, file (url\|base64), text (caption) }` | Usar endpoint especifico |
| `POST /send/document` | `{ number, file, text, docName }` | `docName` = filename no WhatsApp |
| `POST /send/audio` | `{ number, file }` | |
| `POST /send/video` | `{ number, file, text }` | |
| `POST /message/react` | `{ number, text (emoji\|""), id }` | "" remove reacao |
| `POST /message/edit` | `{ id, text }` | Editar msg enviada |
| `POST /message/markread` | `{ id: [wa_message_id, ...] }` | Tick azul |

**IMPORTANTE**: Usar endpoints especificos (`/send/document`, `/send/image`) e NAO `/send/media` para que `filename`/`docName` funcione.

### Token por Instancia

`UAZAPI_INSTANCE_TOKENS` = tokens separados por virgula. EEG (owner 556192894339) = index 0, Recepcao (owner 556183008973) = index 1. Usar `getUazapiToken(categoria)` de `lib/types.ts`.

### Webhook Payload Real — Mensagem Individual

```json
{
  "EventType": "messages",
  "owner": "556192894339",
  "token": "TOKEN",
  "chat": {
    "wa_chatid": "556191223332@s.whatsapp.net",
    "wa_isGroup": false,
    "name": "Nome Contato",
    "phone": "556191223332",
    "imagePreview": "https://pps.whatsapp.net/..."
  },
  "message": {
    "id": "556192894339:AC7CFB9E...",
    "messageid": "AC7CFB9E...",
    "chatid": "556191223332@s.whatsapp.net",
    "fromMe": false,
    "type": "text",
    "text": "conteudo da mensagem",
    "sender": "250624293740768@lid",
    "sender_pn": "556191223332@s.whatsapp.net",
    "senderName": "",
    "isGroup": false,
    "messageTimestamp": 1771692584000
  }
}
```

### Mapeamento de Campos UAZAPI

| Payload | Campo DB | Notas |
|---------|----------|-------|
| `chat.wa_chatid` | `conversas.wa_chatid` | Chave unica |
| `message.messageid` | `mensagens.wa_message_id` | SEM prefixo owner |
| `message.fromMe` | `mensagens.from_me` | Boolean |
| `message.text` | `mensagens.conteudo` | SEMPRE usar `.text` (`.content` pode ser objeto!) |
| `message.sender_pn` | `mensagens.sender_phone` | NUNCA usar `sender` (eh LID!) |
| `chat.name \|\| chat.wa_name` | `conversas.nome_contato` | `wa_contactName` geralmente vazio |
| `chat.imagePreview` | `conversas.avatar_url` | URL direta (nao base64) |
| `owner` | `conversas.categoria` | Via OWNER_CATEGORY_MAP |

### Webhook messages_update (status)

Payload diferente: `{ EventType: 'messages_update', event: { Type: 'Delivered'|'Read', MessageIDs: ['id1',...], Chat: '...' } }`. `event.Type` case-inconsistente — usar `.toLowerCase()`. `MessageIDs` eh ARRAY.

---

## API 360Dialog

- **Base URL**: `https://waba-v2.360dialog.io` | **Auth**: Header `D360-API-KEY`
- Payload segue padrao **Meta Cloud API**
- Webhook GET valida `hub.verify_token` vs `WEBHOOK_SECRET`

### Audio 360Dialog

- **Problema**: Browser grava `audio/webm` — 360Dialog NAO aceita
- **Solucao**: `convertToOgg()` em `send-media/route.ts` usa `ffmpeg-static` para remux webm→ogg (codec opus)
- **ffmpeg path**: Turbopack reescreve path. Usar `getFfmpegPath()` com fallback: sistema → `process.cwd()/node_modules/ffmpeg-static/ffmpeg` → require
- **Payload PTT**: `type: 'audio'` com `voice: true` (NAO usar tipo 'ptt')
- **Formatos aceitos**: `audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg, audio/opus`

### Janela 24h + Templates

- Mensagens de texto livre so entregam se destinatario enviou msg nas ultimas 24h
- Fora da janela: usar templates aprovados pela Meta
- Unico template aprovado: `confirmacao_agendamento` (5 params: nome, data, hora, medico, procedimento)
- API: `POST /api/mensagens/send-template`
- MessageView detecta automaticamente janela expirada e exibe banner + botao "Enviar template"

### Media Download 360Dialog

- `GET /{media_id}` retorna URL Facebook CDN (`lookaside.fbsbx.com`)
- Reescrever URL para proxy `waba-v2.360dialog.io` + header `D360-API-KEY`
- Metadata: `dialog360_media_id` e `provider: '360dialog'` em JSONB

---

## Media Proxy Multi-Provider

`/api/media/[messageId]/route.ts`:
- Detecta provider via `metadata.provider === '360dialog'` ou `metadata.dialog360_media_id`
- UAZAPI: URL direta
- 360Dialog: reescreve Facebook CDN → proxy 360Dialog com header auth
- Cache 30min

---

## Banco de Dados

### Tabela `atd.mensagens`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| conversa_id | FK | → conversas |
| wa_message_id | TEXT UNIQUE | ID curto (sem prefixo owner) |
| from_me | BOOLEAN | |
| tipo_mensagem | TEXT | text, image, audio, video, document, sticker, contact, location |
| conteudo | TEXT | Texto ou caption |
| media_url | TEXT | URL da midia |
| media_mimetype | TEXT | |
| media_filename | TEXT | |
| mencoes | TEXT[] | Array de telefones mencionados |
| edited_at | TIMESTAMPTZ | Se editada |
| is_deleted | BOOLEAN | Soft-delete |
| deleted_at | TIMESTAMPTZ | |
| deleted_by | INTEGER | |
| metadata | JSONB | provider, dialog360_media_id, etc |

### Funcao `atd.registrar_mensagem()`
Insert mensagem + update conversa (ultima_msg, nao_lida, is_archived=FALSE).

---

## Regras e Gotchas

1. **Endpoints especificos UAZAPI** — `/send/document`, `/send/image`, etc. (nao `/send/media`)
2. **message.sender eh LID** — Sempre usar `sender_pn` para telefone
3. **message.content pode ser objeto** — Sempre usar `message.text`
4. **message.messageid sem prefixo** — `message.id` inclui owner, `messageid` nao
5. **Multi-forward delay 1.5s** — Entre envios sequenciais para evitar rate limiting
6. **Cross-provider forward** — Baixa midia do provider original e re-envia ao destino
7. **Validar file.size > 0** antes de enviar midia
8. **AudioRecorder.tsx** — Guard `mountedRef` contra dupla inicializacao React Strict Mode

## SSE Events Relacionados

`nova_mensagem`, `mensagem_status`, `mensagem_editada`, `mensagem_removida` — ver skill `sse-realtime`
