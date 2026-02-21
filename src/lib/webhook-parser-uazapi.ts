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
}

export interface ParsedUAZAPICall {
  wa_chatid: string;
  caller_phone: string;
  owner: string;
  categoria: string;
}

export function isMessageEvent(payload: WebhookPayloadUAZAPI): boolean {
  return payload.EventType === 'messages';
}

export function isCallEvent(payload: WebhookPayloadUAZAPI): boolean {
  return payload.EventType === 'call';
}

export function parseUAZAPIMessage(payload: WebhookPayloadUAZAPI): ParsedUAZAPIMessage | null {
  if (!isMessageEvent(payload)) return null;

  const { chat, message, owner } = payload;
  if (!message?.id || !chat?.wa_chatid) return null;

  const wa_chatid = message.chatid || chat.wa_chatid;
  const isGroup = chat.wa_isGroup === true || wa_chatid.includes('@g.us');
  const categoria = OWNER_CATEGORY_MAP[owner] || 'geral';

  // Extrair telefone do wa_chatid (individual)
  let telefone: string | null = null;
  if (!isGroup && wa_chatid.includes('@')) {
    telefone = wa_chatid.split('@')[0];
  }

  return {
    wa_chatid,
    wa_message_id: message.id,
    from_me: message.fromMe === true,
    sender_phone: message.senderPhone || null,
    sender_name: message.senderName || null,
    tipo_mensagem: message.messageType || 'text',
    conteudo: message.content || message.text || null,
    media_url: null, // UAZAPI envia media em campo separado se houver
    media_mimetype: null,
    media_filename: null,
    tipo: isGroup ? 'grupo' : 'individual',
    categoria,
    provider: 'uazapi',
    nome_contato: chat.wa_contactName || null,
    nome_grupo: isGroup ? (message.groupName || null) : null,
    telefone,
    avatar_url: chat.imagePreview ? `data:image/jpeg;base64,${chat.imagePreview}` : null,
  };
}

export function parseUAZAPICall(payload: WebhookPayloadUAZAPI): ParsedUAZAPICall | null {
  if (!isCallEvent(payload)) return null;

  const wa_chatid = payload.chat?.wa_chatid || payload.message?.from || '';
  if (!wa_chatid) return null;

  const callerPhone = wa_chatid.split('@')[0];
  const categoria = OWNER_CATEGORY_MAP[payload.owner] || 'geral';

  return {
    wa_chatid,
    caller_phone: callerPhone,
    owner: payload.owner,
    categoria,
  };
}
