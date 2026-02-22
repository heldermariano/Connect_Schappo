// =========================================================
// Tipos TypeScript — Connect Schappo
// =========================================================

// --- Entidades do banco (schema atd) ---

export interface Atendente {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  ramal: string | null;
  ativo: boolean;
  role: 'atendente' | 'supervisor' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface Conversa {
  id: number;
  wa_chatid: string;
  tipo: 'individual' | 'grupo';
  categoria: 'eeg' | 'recepcao' | 'geral';
  provider: 'uazapi' | '360dialog';
  nome_contato: string | null;
  nome_grupo: string | null;
  telefone: string | null;
  avatar_url: string | null;
  ultima_mensagem: string | null;
  ultima_msg_at: string | null;
  nao_lida: number;
  is_archived: boolean;
  is_muted: boolean;
  atendente_id: number | null;
  labels: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Mensagem {
  id: number;
  conversa_id: number;
  wa_message_id: string | null;
  from_me: boolean;
  sender_phone: string | null;
  sender_name: string | null;
  tipo_mensagem: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker' | 'reaction';
  conteudo: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  media_filename: string | null;
  is_forwarded: boolean;
  quoted_msg_id: string | null;
  status: 'received' | 'sent' | 'delivered' | 'read' | 'failed';
  mencoes: string[];
  mencoes_resolvidas?: Record<string, string>;
  sender_avatar_url?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Contato {
  id: number;
  nome: string;
  telefone: string | null;
  avatar_url: string | null;
  tipo: 'individual' | 'grupo';
  conversa_id: number | null;
  categoria: 'eeg' | 'recepcao' | 'geral';
  ultima_msg_at: string | null;
}

export interface Chamada {
  id: number;
  conversa_id: number | null;
  wa_chatid: string | null;
  origem: 'whatsapp' | 'telefone' | 'whatsapp-tentativa';
  direcao: 'recebida' | 'realizada';
  caller_number: string | null;
  called_number: string | null;
  ramal_atendeu: string | null;
  atendente_id: number | null;
  status: 'ringing' | 'answered' | 'missed' | 'rejected' | 'voicemail' | 'busy' | 'failed';
  duracao_seg: number;
  inicio_at: string;
  atendida_at: string | null;
  fim_at: string | null;
  gravacao_url: string | null;
  asterisk_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// --- SSE Events ---

export type SSEEvent =
  | { type: 'nova_mensagem'; data: { conversa_id: number; mensagem: Mensagem } }
  | { type: 'conversa_atualizada'; data: { conversa_id: number; ultima_msg: string; nao_lida: number } }
  | { type: 'chamada_nova'; data: { chamada: Chamada } }
  | { type: 'chamada_atualizada'; data: { chamada_id: number; status: string; duracao?: number } }
  | { type: 'ramal_status'; data: { ramal: string; status: 'online' | 'offline' | 'busy' } }
  | { type: 'atendente_status'; data: { atendente_id: number; nome: string; status: string } };

// --- Webhook Payloads ---

export interface WebhookPayloadUAZAPI {
  BaseUrl?: string;
  EventType: 'messages' | 'call' | 'status' | string;
  instanceName?: string;
  owner: string;
  token?: string;
  chatSource?: string;
  chat: {
    wa_chatid: string;
    wa_chatlid?: string;
    wa_isGroup?: boolean;
    wa_contactName?: string;
    wa_name?: string;
    name?: string;
    phone?: string;
    imagePreview?: string;
    wa_unreadCount?: number;
  };
  message: {
    id: string;
    messageid?: string;
    fromMe?: boolean;
    content?: string | { text: string; contextInfo?: Record<string, unknown> };
    text?: string;
    mentionedJid?: string[];
    type?: string;
    messageType?: string;
    chatid?: string;
    chatlid?: string;
    sender?: string;
    sender_pn?: string;
    sender_lid?: string;
    senderName?: string;
    senderPhone?: string;
    pushName?: string;
    isGroup?: boolean;
    groupName?: string;
    from?: string;
    messageTimestamp?: number;
    source?: string;
    wasSentByApi?: boolean;
    quoted?: string;
    reaction?: string;
    edited?: string;
  };
}

export interface WebhookPayload360Dialog {
  object: string;
  entry: Array<{
    id?: string;
    changes: Array<{
      value: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        messages?: Array<{
          from: string;
          id: string;
          type: string;
          timestamp: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; caption?: string };
          audio?: { id: string; mime_type: string };
          video?: { id: string; mime_type: string; caption?: string };
          document?: { id: string; mime_type: string; filename?: string; caption?: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
          contacts?: Array<{ name: { formatted_name: string }; phones?: Array<{ phone: string }> }>;
          sticker?: { id: string; mime_type: string };
          reaction?: { message_id: string; emoji: string };
        }>;
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field?: string;
    }>;
  }>;
}

// --- Mapeamento Owner -> Categoria ---

export const OWNER_CATEGORY_MAP: Record<string, string> = {
  '556192894339': 'eeg',
  '556183008973': 'recepcao',
  '556133455701': 'geral',
};
