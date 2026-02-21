# Correção do Payload UAZAPI — Baseado em Dados Reais

## Instruções para Claude Code

Atualize os seguintes arquivos com as correções abaixo. Os payloads reais da UAZAPI diferem significativamente do que foi documentado originalmente.

---

## 1. Atualizar CLAUDE.md — Seção "Payload do webhook UAZAPI"

### SUBSTITUIR o payload de mensagem recebida por:

#### Payload REAL — Mensagem individual:

```json
{
  "BaseUrl": "https://schappo.uazapi.com",
  "EventType": "messages",
  "instanceName": "EEG",
  "owner": "556192894339",
  "token": "TOKEN_DA_INSTANCIA",
  "chatSource": "updated",
  "chat": {
    "wa_chatid": "556191223332@s.whatsapp.net",
    "wa_chatlid": "250624293740768@lid",
    "wa_isGroup": false,
    "wa_contactName": "",
    "wa_name": "",
    "name": "",
    "phone": "556191223332",
    "imagePreview": "",
    "wa_unreadCount": 1
  },
  "message": {
    "id": "556192894339:AC7CFB9E5C7742D8BFE91B9803942A67",
    "messageid": "AC7CFB9E5C7742D8BFE91B9803942A67",
    "chatid": "556191223332@s.whatsapp.net",
    "chatlid": "250624293740768@lid",
    "fromMe": false,
    "type": "text",
    "messageType": "ExtendedTextMessage",
    "text": "Bom dia, gostaria de ter acesso ao exame",
    "content": {
      "text": "Bom dia, gostaria de ter acesso ao exame",
      "contextInfo": { "expiration": 7776000 }
    },
    "sender": "250624293740768@lid",
    "sender_pn": "556191223332@s.whatsapp.net",
    "sender_lid": "250624293740768@lid",
    "senderName": "",
    "isGroup": false,
    "groupName": "Unknown",
    "messageTimestamp": 1771692584000,
    "source": "android",
    "wasSentByApi": false
  }
}
```

#### Payload REAL — Mensagem de grupo:

```json
{
  "BaseUrl": "https://schappo.uazapi.com",
  "EventType": "messages",
  "instanceName": "EEG",
  "owner": "556192894339",
  "token": "TOKEN_DA_INSTANCIA",
  "chatSource": "updated",
  "chat": {
    "wa_chatid": "120363400460335306@g.us",
    "wa_isGroup": true,
    "wa_contactName": "",
    "wa_name": "CLAUDIA DOMINGO",
    "name": "CLAUDIA DOMINGO",
    "phone": "",
    "imagePreview": "https://pps.whatsapp.net/v/t61.24694-24/...",
    "wa_unreadCount": 44
  },
  "message": {
    "id": "556192894339:4AF07FA16B4843F9853D",
    "messageid": "4AF07FA16B4843F9853D",
    "chatid": "120363400460335306@g.us",
    "fromMe": false,
    "type": "text",
    "messageType": "Conversation",
    "text": "*EEG 21/02/2026 - Claudia*\n\n🧠 Paciente...",
    "content": "*EEG 21/02/2026 - Claudia*\n\n🧠 Paciente...",
    "sender": "88807777009685@lid",
    "sender_pn": "556191827054@s.whatsapp.net",
    "sender_lid": "88807777009685@lid",
    "senderName": "Claudia Santrib",
    "isGroup": true,
    "groupName": "CLAUDIA DOMINGO",
    "messageTimestamp": 1771712966000,
    "wasSentByApi": false
  }
}
```

---

## 2. Atualizar CLAUDE.md — Seção "Mapeamento de campos"

### SUBSTITUIR tabela de mapeamento por:

| UAZAPI Payload | Campo no Banco | Notas |
|---|---|---|
| `chat.wa_chatid` | `conversas.wa_chatid` | Chave única da conversa |
| `message.messageid` | `mensagens.wa_message_id` | Usar `messageid` (sem owner prefix) |
| `message.fromMe` | `mensagens.from_me` | Boolean |
| `message.text` | `mensagens.conteudo` | ⚠️ SEMPRE usar `.text` (é string). `.content` pode ser objeto! |
| `message.type` | `mensagens.tipo_mensagem` | 'text', 'image', 'audio', etc. |
| `chat.name \|\| chat.wa_name` | `conversas.nome_contato` | ⚠️ `wa_contactName` geralmente vazio |
| `message.groupName \|\| chat.name` | `conversas.nome_grupo` | Para grupos |
| `chat.wa_isGroup` | `conversas.tipo` | true→'grupo', false→'individual' |
| `owner` | `conversas.categoria` | Via OWNER_CATEGORY_MAP |
| `chat.imagePreview` | `conversas.avatar_url` | ⚠️ É URL (não base64!) |
| `message.senderName` | `mensagens.sender_name` | Pode estar vazio em individuais |
| `message.sender_pn` | `mensagens.sender_phone` | ⚠️ Usar `sender_pn`, NÃO `sender` (que é LID) |
| `chat.phone` | `conversas.telefone` | Em individual; vazio em grupo |
| `body.token` | validação webhook | Comparar com WEBHOOK_SECRET |

---

## 3. Código do Parser Corrigido

### Arquivo: `src/lib/webhook-parser-uazapi.ts`

```typescript
import { OWNER_CATEGORY_MAP } from './types';

interface ParsedMessage {
  wa_chatid: string;
  wa_message_id: string;
  from_me: boolean;
  sender_phone: string;
  sender_name: string;
  tipo_mensagem: string;
  conteudo: string;
  media_url: string | null;
  media_mimetype: string | null;
  media_filename: string | null;
  is_group: boolean;
  nome_contato: string;
  nome_grupo: string | null;
  telefone: string;
  avatar_url: string | null;
  categoria: string;
  provider: string;
  metadata: Record<string, unknown>;
}

/**
 * Extrai o texto da mensagem de forma segura.
 * message.content pode ser string OU objeto com campo .text
 * message.text é sempre string (mais confiável)
 */
function extractMessageText(message: any): string {
  // Prioridade 1: message.text (sempre string)
  if (message.text && typeof message.text === 'string') {
    return message.text;
  }
  // Prioridade 2: message.content (pode ser string ou objeto)
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (message.content && typeof message.content === 'object' && message.content.text) {
    return message.content.text;
  }
  return '';
}

/**
 * Extrai o telefone do remetente.
 * NUNCA usar message.sender (é LID, formato @lid)
 * SEMPRE usar message.sender_pn (formato @s.whatsapp.net)
 */
function extractSenderPhone(message: any): string {
  // Prioridade 1: sender_pn (telefone real)
  if (message.sender_pn) {
    return message.sender_pn.replace('@s.whatsapp.net', '');
  }
  // Prioridade 2: chatid para individuais
  if (!message.isGroup && message.chatid) {
    return message.chatid.replace('@s.whatsapp.net', '');
  }
  // Fallback: sender (pode ser LID, mas é melhor que nada)
  if (message.sender) {
    return message.sender.replace('@s.whatsapp.net', '').replace('@lid', '');
  }
  return '';
}

/**
 * Extrai o nome do contato/remetente.
 * chat.wa_contactName geralmente está vazio!
 * Usar chat.name ou chat.wa_name como fallback
 */
function extractContactName(chat: any, message: any): string {
  if (chat.wa_isGroup) {
    // Em grupos, o nome do contato é o remetente
    return message.senderName || '';
  }
  // Para individuais: chat.name > chat.wa_name > chat.wa_contactName
  return chat.name || chat.wa_name || chat.wa_contactName || '';
}

/**
 * Extrai o nome do grupo
 */
function extractGroupName(chat: any, message: any): string | null {
  if (!chat.wa_isGroup) return null;
  return message.groupName || chat.name || chat.wa_name || null;
}

/**
 * Extrai o telefone da conversa (individual)
 */
function extractConversationPhone(chat: any): string {
  // chat.phone existe e tem valor para individuais
  if (chat.phone) return chat.phone;
  // Fallback: extrair de wa_chatid
  if (chat.wa_chatid && !chat.wa_chatid.includes('@g.us')) {
    return chat.wa_chatid.replace('@s.whatsapp.net', '');
  }
  return '';
}

/**
 * Parser principal do webhook UAZAPI
 */
export function parseUazapiWebhook(body: any): ParsedMessage | null {
  // Validar que é uma mensagem
  if (body.EventType !== 'messages') return null;
  if (!body.message || !body.chat) return null;

  const { chat, message, owner } = body;

  // Ignorar mensagens enviadas pela API (evitar loop)
  if (message.wasSentByApi) return null;

  // Determinar categoria pelo owner
  const categoria = OWNER_CATEGORY_MAP[owner] || 'geral';

  // Determinar tipo de mensagem
  let tipo_mensagem = message.type || 'text';
  // Normalizar: 'Conversation' e 'ExtendedTextMessage' = 'text'
  if (message.messageType === 'Conversation' || message.messageType === 'ExtendedTextMessage') {
    tipo_mensagem = 'text';
  }

  const parsed: ParsedMessage = {
    wa_chatid: chat.wa_chatid,
    wa_message_id: message.messageid || message.id,
    from_me: message.fromMe || false,
    sender_phone: extractSenderPhone(message),
    sender_name: message.senderName || extractContactName(chat, message),
    tipo_mensagem,
    conteudo: extractMessageText(message),
    media_url: null,      // TODO: extrair para mensagens de mídia
    media_mimetype: null,
    media_filename: null,
    is_group: chat.wa_isGroup || false,
    nome_contato: extractContactName(chat, message),
    nome_grupo: extractGroupName(chat, message),
    telefone: extractConversationPhone(chat),
    avatar_url: chat.imagePreview || null,  // É URL, não base64!
    categoria,
    provider: 'uazapi',
    metadata: {
      instance_name: body.instanceName,
      message_type_raw: message.messageType,
      sender_lid: message.sender_lid,
      chat_source: body.chatSource,
      timestamp: message.messageTimestamp,
    },
  };

  return parsed;
}

/**
 * Verifica se o payload é um evento de chamada
 */
export function isCallEvent(body: any): boolean {
  return body.EventType === 'call';
}

/**
 * Verifica o token do webhook
 */
export function validateWebhookToken(body: any, expectedToken: string): boolean {
  return body.token === expectedToken;
}
```

---

## 4. Observações Críticas para o Claude Code

### ⚠️ CUIDADO: message.sender é LID, não telefone!

A UAZAPI agora usa **LIDs (Linked IDs)** em vez de telefones em vários campos:
- `message.sender` = `88807777009685@lid` ← NÃO é telefone!
- `message.sender_pn` = `556191827054@s.whatsapp.net` ← ESTE é o telefone
- `message.sender_lid` = mesma coisa que `message.sender`

### ⚠️ CUIDADO: message.content pode ser string OU objeto!

- Tipo `Conversation`: `content` é string
- Tipo `ExtendedTextMessage`: `content` é `{ text: "...", contextInfo: {...} }`
- **Sempre usar `message.text`** que é string em ambos os casos

### ⚠️ CUIDADO: chat.wa_contactName geralmente está vazio!

Ordem de prioridade para nome do contato:
1. `chat.name`
2. `chat.wa_name`
3. `chat.wa_contactName`
4. Número formatado como fallback

### ⚠️ CUIDADO: chat.imagePreview é URL, não base64!

```
"imagePreview": "https://pps.whatsapp.net/v/t61.24694-24/..."
```

Pode ser salva diretamente como `avatar_url` no banco.

### ⚠️ CUIDADO: message.id inclui prefixo do owner!

```
"id": "556192894339:4AF07FA16B4843F9853D"    ← com prefixo owner
"messageid": "4AF07FA16B4843F9853D"           ← sem prefixo (usar este para UNIQUE)
```

Usar `messageid` para o campo `wa_message_id` no banco (evita prefixo duplicado).

---

## 5. Campos adicionais disponíveis (úteis para futuro)

| Campo | Tipo | Descrição |
|---|---|---|
| `body.instanceName` | string | Nome da instância UAZAPI ("EEG") |
| `body.BaseUrl` | string | URL da instância |
| `body.token` | string | Token para validação |
| `body.chatSource` | string | "updated" |
| `chat.wa_unreadCount` | number | Mensagens não lidas no WhatsApp |
| `chat.wa_label` | array | Labels do WhatsApp |
| `chat.wa_isPinned` | boolean | Se está fixado |
| `chat.wa_isBlocked` | boolean | Se está bloqueado |
| `chat.wa_ephemeralExpiration` | number | Tempo de mensagem temporária |
| `message.sender_lid` | string | LID do remetente |
| `message.chatlid` | string | LID do chat |
| `message.quoted` | string | Mensagem citada (se houver) |
| `message.reaction` | string | Reação (se houver) |
| `message.edited` | string | Se foi editada |
| `message.source` | string | "android", "web", etc. |
| `message.messageTimestamp` | number | Timestamp em milissegundos |
