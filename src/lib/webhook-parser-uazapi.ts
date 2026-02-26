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
  mencoes: string[];
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
 * NUNCA retornar JSON bruto — sempre extrair o texto limpo
 */
function extractMessageText(message: WebhookPayloadUAZAPI['message']): string {
  // Prioridade 1: message.text (sempre string)
  if (message.text && typeof message.text === 'string') {
    return message.text;
  }
  // Prioridade 2: message.content como string
  if (typeof message.content === 'string') {
    // Se parecer JSON, tentar parsear e extrair .text
    if (message.content.startsWith('{')) {
      try {
        const parsed = JSON.parse(message.content);
        if (parsed.text) return parsed.text;
      } catch { /* nao eh JSON valido, usar como string */ }
    }
    return message.content;
  }
  // Prioridade 3: message.content como objeto
  if (message.content && typeof message.content === 'object') {
    if ('text' in message.content && typeof message.content.text === 'string') {
      return message.content.text;
    }
    // Para reacoes, extrair o emoji
    if ('text' in message.content) {
      return String(message.content.text || '');
    }
  }
  return '';
}

/**
 * Extrai URL de midia do payload.
 * Para mensagens de midia (imagem, audio, video, documento, sticker),
 * a URL esta dentro de message.content como objeto com campo URL.
 */
function extractMediaUrl(message: WebhookPayloadUAZAPI['message']): string | null {
  const content = message.content;
  if (!content || typeof content !== 'object') return null;

  // URL direta no content
  if ('URL' in content && typeof content.URL === 'string') {
    return content.URL;
  }
  // URL dentro de submensagem (quotedMessage.imageMessage.URL etc)
  return null;
}

/**
 * Extrai mimetype da midia do payload.
 */
function extractMediaMimetype(message: WebhookPayloadUAZAPI['message']): string | null {
  const content = message.content;
  if (!content || typeof content !== 'object') return null;
  if ('mimetype' in content && typeof content.mimetype === 'string') {
    return content.mimetype;
  }
  return null;
}

/**
 * Extrai nome do arquivo da midia.
 */
function extractMediaFilename(message: WebhookPayloadUAZAPI['message']): string | null {
  const content = message.content;
  if (!content || typeof content !== 'object') return null;
  if ('fileName' in content && typeof content.fileName === 'string') {
    return content.fileName;
  }
  if ('title' in content && typeof content.title === 'string') {
    return content.title;
  }
  return null;
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
 * Extrai o nome do remetente em grupos.
 * Prioridade: pushName > senderName
 */
function extractSenderName(message: WebhookPayloadUAZAPI['message']): string {
  return message.pushName || message.senderName || '';
}

/**
 * Extrai o nome do contato/remetente.
 * chat.wa_contactName geralmente esta vazio!
 * Usar chat.name ou chat.wa_name como fallback
 */
function extractContactName(chat: WebhookPayloadUAZAPI['chat'], message: WebhookPayloadUAZAPI['message']): string {
  if (chat.wa_isGroup) {
    // Em grupos, o nome do contato eh o remetente
    return extractSenderName(message);
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
 * Detecta se uma videoMessage eh na verdade um GIF (gifPlayback).
 * WhatsApp envia GIFs como video/mp4 com gifPlayback: true no content.
 */
function isGifPlayback(message: WebhookPayloadUAZAPI['message']): boolean {
  const content = message.content;
  if (!content || typeof content !== 'object') return false;
  return 'gifPlayback' in content && content.gifPlayback === true;
}

/**
 * Normaliza o tipo de mensagem.
 * UAZAPI envia messageType em PascalCase (ex: 'ExtendedTextMessage', 'ImageMessage').
 * Normalizar para tipos simples: text, image, audio, video, document, sticker, reaction, contact, location
 */
function normalizeMessageType(message: WebhookPayloadUAZAPI['message']): string {
  const rawType = message.messageType || message.type || 'text';
  const lower = rawType.toLowerCase();

  // Tipos de texto
  if (lower === 'conversation' || lower === 'extendedtextmessage') {
    return 'text';
  }
  // Tipos de midia — extrair nome base
  if (lower.endsWith('message')) {
    const base = lower.replace('message', '');
    // Mapear nomes conhecidos
    const MAP: Record<string, string> = {
      image: 'image',
      audio: 'audio',
      video: 'video',
      document: 'document',
      sticker: 'sticker',
      reaction: 'reaction',
      contact: 'contact',
      location: 'location',
      liveLocation: 'location',
      livelocation: 'location',
    };
    const tipo = MAP[base] || base;
    // GIF: WhatsApp envia como videoMessage com gifPlayback=true
    if (tipo === 'video' && isGifPlayback(message)) {
      return 'image'; // Tratar GIF como imagem para exibicao
    }
    return tipo;
  }
  return lower;
}

/**
 * Extrai identificadores mencionados do payload.
 * UAZAPI envia mentionedJid como array de JIDs — podem ser:
 *   - Telefones: "5561999999999@s.whatsapp.net"
 *   - LIDs: "125786891759786@lid"
 * Tambem tenta extrair do contextInfo dentro de content (objeto)
 */
function extractMentions(message: WebhookPayloadUAZAPI['message']): string[] {
  const jids: string[] = [];

  // Prioridade 1: campo mentionedJid direto
  if (Array.isArray(message.mentionedJid)) {
    jids.push(...message.mentionedJid);
  }

  // Prioridade 2: contextInfo.mentionedJid dentro de content objeto
  if (message.content && typeof message.content === 'object' && 'contextInfo' in message.content) {
    const ctx = message.content.contextInfo;
    if (ctx && typeof ctx === 'object' && 'mentionedJid' in ctx && Array.isArray(ctx.mentionedJid)) {
      jids.push(...(ctx.mentionedJid as string[]));
    }
  }

  // Normalizar: remover @s.whatsapp.net e @lid, deduplicar
  const ids = [...new Set(jids.map((j) => j.replace('@s.whatsapp.net', '').replace('@lid', '')))];
  return ids;
}

export function isMessageEvent(payload: WebhookPayloadUAZAPI): boolean {
  return payload.EventType === 'messages';
}

export function isCallEvent(payload: WebhookPayloadUAZAPI): boolean {
  return payload.EventType === 'call';
}

/**
 * Verifica o token do webhook (UAZAPI envia o token da instancia no body).
 * Aceita WEBHOOK_SECRET ou qualquer UAZAPI_INSTANCE_TOKENS (separados por virgula).
 */
export function validateWebhookToken(payload: WebhookPayloadUAZAPI, expectedToken: string): boolean {
  if (!payload.token) return false;
  // Verificar contra o WEBHOOK_SECRET
  if (payload.token === expectedToken) return true;
  // Verificar contra os tokens das instancias UAZAPI
  const instanceTokens = process.env.UAZAPI_INSTANCE_TOKENS || process.env.UAZAPI_TOKEN || '';
  const tokens = instanceTokens.split(',').map((t) => t.trim()).filter(Boolean);
  return tokens.includes(payload.token);
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
    sender_name: extractSenderName(message) || extractContactName(chat, message) || null,
    tipo_mensagem: normalizeMessageType(message),
    conteudo: extractMessageText(message) || null,
    media_url: extractMediaUrl(message),
    // GIF: sobrescrever mimetype para image/gif (WhatsApp envia como video/mp4)
    media_mimetype: isGifPlayback(message) ? 'image/gif' : extractMediaMimetype(message),
    media_filename: extractMediaFilename(message),
    tipo: isGroup ? 'grupo' : 'individual',
    categoria,
    provider: 'uazapi',
    nome_contato: extractContactName(chat, message) || null,
    nome_grupo: extractGroupName(chat, message),
    telefone: extractConversationPhone(chat) || null,
    avatar_url: chat.imagePreview || null, // Eh URL, nao base64!
    mencoes: extractMentions(message),
    metadata: {
      instance_name: payload.instanceName,
      message_type_raw: message.messageType,
      sender_lid: message.sender_lid,
      chat_source: payload.chatSource,
      timestamp: message.messageTimestamp,
      message_id_full: message.id, // ID completo com owner prefix para download de midia
      ...(message.reaction ? { reacted_to: message.reaction } : {}),
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
