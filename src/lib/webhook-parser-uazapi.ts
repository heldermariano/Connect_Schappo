import { WebhookPayloadUAZAPI, OWNER_CATEGORY_MAP } from './types';

// Dados normalizados extraidos do payload UAZAPI
export interface ParsedUAZAPIMessage {
  wa_chatid: string;
  wa_message_id: string;
  from_me: boolean;
  sender_phone: string | null;
  sender_name: string | null;
  tipo_mensagem: string;
  conteudo: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  media_filename: string | null;
  // Dados da conversa
  tipo: 'individual' | 'grupo';
  categoria: string;
  provider: 'uazapi';
  nome_contato: string | null;
  nome_grupo: string | null;
  telefone: string | null;
  avatar_url: string | null;
  metadata: Record<string, unknown>;
}

export interface ParsedUAZAPICall {
  wa_chatid: string;
  caller_phone: string;
  owner: string;
  categoria: string;
}

/**
 * Extrai o texto da mensagem de forma segura.
 * message.content pode ser string OU objeto com campo .text
 * message.text eh sempre string (mais confiavel)
 */
function extractMessageText(message: WebhookPayloadUAZAPI['message']): string {
  // Prioridade 1: message.text (sempre string)
  if (message.text && typeof message.text === 'string') {
    return message.text;
  }
  // Prioridade 2: message.content (pode ser string ou objeto)
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (message.content && typeof message.content === 'object' && 'text' in message.content) {
    return message.content.text;
  }
  return '';
}

/**
 * Extrai o telefone do remetente.
 * NUNCA usar message.sender (eh LID, formato @lid)
 * SEMPRE usar message.sender_pn (formato @s.whatsapp.net)
 */
function extractSenderPhone(message: WebhookPayloadUAZAPI['message']): string {
  // Prioridade 1: sender_pn (telefone real)
  if (message.sender_pn) {
    return message.sender_pn.replace('@s.whatsapp.net', '');
  }
  // Prioridade 2: senderPhone (campo legado)
  if (message.senderPhone) {
    return message.senderPhone;
  }
  // Prioridade 3: chatid para individuais
  if (!message.isGroup && message.chatid) {
    return message.chatid.replace('@s.whatsapp.net', '');
  }
  return '';
}

/**
 * Extrai o nome do contato/remetente.
 * chat.wa_contactName geralmente esta vazio!
 * Usar chat.name ou chat.wa_name como fallback
 */
function extractContactName(chat: WebhookPayloadUAZAPI['chat'], message: WebhookPayloadUAZAPI['message']): string {
  if (chat.wa_isGroup) {
    // Em grupos, o nome do contato eh o remetente
    return message.senderName || '';
  }
  // Para individuais: chat.name > chat.wa_name > chat.wa_contactName
  return chat.name || chat.wa_name || chat.wa_contactName || '';
}

/**
 * Extrai o nome do grupo
 */
function extractGroupName(chat: WebhookPayloadUAZAPI['chat'], message: WebhookPayloadUAZAPI['message']): string | null {
  if (!chat.wa_isGroup) return null;
  return message.groupName || chat.name || chat.wa_name || null;
}

/**
 * Extrai o telefone da conversa (individual)
 */
function extractConversationPhone(chat: WebhookPayloadUAZAPI['chat']): string {
  // chat.phone existe e tem valor para individuais
  if (chat.phone) return chat.phone;
  // Fallback: extrair de wa_chatid
  if (chat.wa_chatid && !chat.wa_chatid.includes('@g.us')) {
    return chat.wa_chatid.replace('@s.whatsapp.net', '');
  }
  return '';
}

/**
 * Normaliza o tipo de mensagem.
 * UAZAPI envia 'Conversation' e 'ExtendedTextMessage' para texto.
 */
function normalizeMessageType(message: WebhookPayloadUAZAPI['message']): string {
  const rawType = message.messageType || message.type || 'text';
  // Normalizar tipos de texto
  if (rawType === 'Conversation' || rawType === 'ExtendedTextMessage') {
    return 'text';
  }
  return rawType.toLowerCase();
}

export function isMessageEvent(payload: WebhookPayloadUAZAPI): boolean {
  return payload.EventType === 'messages';
}

export function isCallEvent(payload: WebhookPayloadUAZAPI): boolean {
  return payload.EventType === 'call';
}

/**
 * Verifica o token do webhook (UAZAPI envia no body, nao no header)
 */
export function validateWebhookToken(payload: WebhookPayloadUAZAPI, expectedToken: string): boolean {
  return payload.token === expectedToken;
}

export function parseUAZAPIMessage(payload: WebhookPayloadUAZAPI): ParsedUAZAPIMessage | null {
  if (!isMessageEvent(payload)) return null;

  const { chat, message, owner } = payload;
  if (!chat?.wa_chatid) return null;

  // Ignorar mensagens enviadas pela API (evitar loop)
  if (message.wasSentByApi) return null;

  const wa_chatid = chat.wa_chatid;
  const isGroup = chat.wa_isGroup === true || wa_chatid.includes('@g.us');
  const categoria = OWNER_CATEGORY_MAP[owner] || 'geral';

  // Usar messageid (sem prefixo owner) para campo UNIQUE no banco
  const wa_message_id = message.messageid || message.id;

  return {
    wa_chatid,
    wa_message_id,
    from_me: message.fromMe === true,
    sender_phone: extractSenderPhone(message) || null,
    sender_name: message.senderName || extractContactName(chat, message) || null,
    tipo_mensagem: normalizeMessageType(message),
    conteudo: extractMessageText(message) || null,
    media_url: null, // TODO: extrair para mensagens de midia
    media_mimetype: null,
    media_filename: null,
    tipo: isGroup ? 'grupo' : 'individual',
    categoria,
    provider: 'uazapi',
    nome_contato: extractContactName(chat, message) || null,
    nome_grupo: extractGroupName(chat, message),
    telefone: extractConversationPhone(chat) || null,
    avatar_url: chat.imagePreview || null, // Eh URL, nao base64!
    metadata: {
      instance_name: payload.instanceName,
      message_type_raw: message.messageType,
      sender_lid: message.sender_lid,
      chat_source: payload.chatSource,
      timestamp: message.messageTimestamp,
    },
  };
}

export function parseUAZAPICall(payload: WebhookPayloadUAZAPI): ParsedUAZAPICall | null {
  if (!isCallEvent(payload)) return null;

  const wa_chatid = payload.chat?.wa_chatid || payload.message?.from || '';
  if (!wa_chatid) return null;

  // Extrair telefone: usar chat.phone ou extrair de wa_chatid
  let callerPhone = payload.chat?.phone || '';
  if (!callerPhone) {
    callerPhone = wa_chatid.split('@')[0];
  }

  const categoria = OWNER_CATEGORY_MAP[payload.owner] || 'geral';

  return {
    wa_chatid,
    caller_phone: callerPhone,
    owner: payload.owner,
    categoria,
  };
}
