import { WebhookPayload360Dialog } from './types';

// Dados normalizados extraidos do payload 360Dialog (Meta Cloud API)
export interface Parsed360Message {
  wa_chatid: string;
  wa_message_id: string;
  from_me: false; // Webhooks 360Dialog sao sempre mensagens recebidas
  sender_phone: string;
  sender_name: string | null;
  tipo_mensagem: string;
  conteudo: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  media_filename: string | null;
  // Dados da conversa
  tipo: 'individual';
  categoria: 'geral';
  provider: '360dialog';
  nome_contato: string | null;
  telefone: string;
}

export interface Parsed360Status {
  wa_message_id: string;
  status: string;
  recipient_id: string;
  timestamp: string;
}

export function parse360DialogPayload(payload: WebhookPayload360Dialog): {
  messages: Parsed360Message[];
  statuses: Parsed360Status[];
} {
  const messages: Parsed360Message[] = [];
  const statuses: Parsed360Status[] = [];

  if (!payload.entry) return { messages, statuses };

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value;

      // Processar mensagens
      if (value.messages) {
        const contactsMap = new Map<string, string>();
        if (value.contacts) {
          for (const c of value.contacts) {
            contactsMap.set(c.wa_id, c.profile.name);
          }
        }

        for (const msg of value.messages) {
          const senderName = contactsMap.get(msg.from) || null;
          const wa_chatid = `${msg.from}@s.whatsapp.net`;

          // Extrair conteudo conforme tipo
          let conteudo: string | null = null;
          let media_mimetype: string | null = null;
          let media_filename: string | null = null;

          switch (msg.type) {
            case 'text':
              conteudo = msg.text?.body || null;
              break;
            case 'image':
              conteudo = msg.image?.caption || null;
              media_mimetype = msg.image?.mime_type || null;
              break;
            case 'video':
              conteudo = msg.video?.caption || null;
              media_mimetype = msg.video?.mime_type || null;
              break;
            case 'audio':
              media_mimetype = msg.audio?.mime_type || null;
              break;
            case 'document':
              conteudo = msg.document?.caption || null;
              media_mimetype = msg.document?.mime_type || null;
              media_filename = msg.document?.filename || null;
              break;
            case 'location':
              conteudo = msg.location
                ? `${msg.location.latitude},${msg.location.longitude}${msg.location.name ? ' - ' + msg.location.name : ''}`
                : null;
              break;
            case 'contacts':
              conteudo = msg.contacts?.map((c) => c.name.formatted_name).join(', ') || null;
              break;
            case 'reaction':
              conteudo = msg.reaction?.emoji || null;
              break;
            default:
              break;
          }

          messages.push({
            wa_chatid,
            wa_message_id: msg.id,
            from_me: false,
            sender_phone: msg.from,
            sender_name: senderName,
            tipo_mensagem: msg.type,
            conteudo,
            media_url: null, // Media precisa ser baixada via API separada
            media_mimetype,
            media_filename,
            tipo: 'individual',
            categoria: 'geral',
            provider: '360dialog',
            nome_contato: senderName,
            telefone: msg.from,
          });
        }
      }

      // Processar status updates (delivered, read, etc.)
      if (value.statuses) {
        for (const s of value.statuses) {
          statuses.push({
            wa_message_id: s.id,
            status: s.status,
            recipient_id: s.recipient_id,
            timestamp: s.timestamp,
          });
        }
      }
    }
  }

  return { messages, statuses };
}
