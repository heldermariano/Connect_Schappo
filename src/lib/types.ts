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
  sip_server: string | null;
  sip_port: number;
  sip_username: string | null;
  sip_transport: 'wss' | 'ws';
  sip_enabled: boolean;
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
  ultima_msg_from_me: boolean;
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
  quoted_message?: {
    id: number;
    wa_message_id: string | null;
    sender_name: string | null;
    sender_phone: string | null;
    from_me: boolean;
    tipo_mensagem: string;
    conteudo: string | null;
    media_filename: string | null;
  } | null;
  reactions?: Array<{ emoji: string; sender_name: string | null; from_me: boolean }>;
  is_edited?: boolean;
  edited_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Contato {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  avatar_url: string | null;
  tipo: 'individual' | 'grupo';
  conversa_id: number | null;
  categoria: 'eeg' | 'recepcao' | 'geral';
  ultima_msg_at: string | null;
  chatwoot_id: number | null;
  notas: string | null;
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

// --- Respostas Prontas ---

export interface RespostaPronta {
  id: number;
  atendente_id: number;
  atalho: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
}

// --- Chat Interno ---

export interface ChatInterno {
  id: number;
  participante1_id: number;
  participante2_id: number;
  ultima_mensagem: string | null;
  ultima_msg_at: string | null;
  created_at: string;
  // Campos calculados (JOIN)
  outro_id?: number;
  outro_nome?: string;
  outro_status?: string;
  nao_lidas?: number;
}

export interface ChatInternoMensagem {
  id: number;
  chat_id: number;
  atendente_id: number;
  conteudo: string | null;
  lida: boolean;
  created_at: string;
  // Media
  tipo?: 'text' | 'image' | 'audio' | 'video' | 'document' | 'ptt';
  media_url?: string | null;
  media_mimetype?: string | null;
  media_filename?: string | null;
  // Reacoes
  reacoes?: Array<{ emoji: string; atendente_id: number; nome: string }>;
  // Reply
  reply_to_id?: number | null;
  reply_to?: { conteudo: string | null; nome_remetente: string } | null;
  // JOIN
  nome_remetente?: string;
}

// --- Hub Usuarios (Tecnicos) ---

export interface HubUsuario {
  id: number;
  nome: string;
  telefone: string;
  cargo: string;
  setor: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// --- Alertas Ficha EEG ---

export interface EegAlertaFicha {
  id: number;
  exam_id: string;
  patient_id: string | null;
  tecnico_nome: string | null;
  tecnico_id: number | null;
  tecnico_telefone: string | null;
  tecnico_tipo: 'plantonista' | 'rotineiro' | null;
  campos_faltantes: string[];
  total_campos_ok: number;
  total_campos: number;
  corrigido: boolean;
  corrigido_at: string | null;
  notificado_correcao: boolean;
  paciente_nome: string | null;
  data_exame: string | null;
  created_at: string;
  updated_at: string;
}

export interface TecnicoAlertasSummary {
  total: number;
  pendentes: number;
  corrigidos: number;
}

// --- SIP / Softphone ---

export interface SipSettings {
  sip_server: string;
  sip_port: number;
  sip_username: string;
  sip_password: string;
  sip_transport: 'wss' | 'ws';
  sip_enabled: boolean;
}

export type SipRegistrationState = 'unregistered' | 'registering' | 'registered' | 'error';

export type SipCallState = 'idle' | 'calling' | 'ringing' | 'in-call' | 'on-hold';

// --- SSE Events ---

export type SSEEvent =
  | { type: 'nova_mensagem'; data: { conversa_id: number; mensagem: Mensagem; categoria?: string; tipo?: string } }
  | { type: 'conversa_atualizada'; data: { conversa_id: number; ultima_msg: string; nao_lida: number; atendente_id?: number | null; atendente_nome?: string | null; ultima_msg_from_me?: boolean } }
  | { type: 'chamada_nova'; data: { chamada: Chamada } }
  | { type: 'chamada_atualizada'; data: { chamada_id: number; status: string; duracao?: number } }
  | { type: 'ramal_status'; data: { ramal: string; status: 'online' | 'offline' | 'busy' } }
  | { type: 'atendente_status'; data: { atendente_id: number; nome: string; status: string } }
  | { type: 'softphone_incoming'; data: { caller_number: string; caller_name?: string } }
  | { type: 'chat_interno_mensagem'; data: { chat_id: number; mensagem: ChatInternoMensagem; destinatario_id: number } }
  | { type: 'chat_interno_reacao'; data: { chat_id: number; mensagem_id: number; reacoes: Array<{ emoji: string; atendente_id: number; nome: string }>; destinatario_id: number } };

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

// Mapeamento Categoria -> Owner (numero que envia)
export const CATEGORIA_OWNER: Record<string, string> = {
  eeg: '556192894339',
  recepcao: '556183008973',
  geral: '556133455701',
};

// Mapeamento Owner -> Token UAZAPI (seleciona instancia correta)
// UAZAPI_INSTANCE_TOKENS: token_eeg,token_recepcao (mesma ordem dos owners)
const OWNER_TOKEN_MAP: Record<string, number> = {
  '556192894339': 0, // eeg = primeiro token
  '556183008973': 1, // recepcao = segundo token
};

/**
 * Retorna o token UAZAPI correto para a categoria da conversa.
 * Cada instancia UAZAPI (EEG, Recepcao) tem seu proprio token.
 * Enviar com token errado causa 500 em grupos (instancia nao participa do grupo).
 */
export function getUazapiToken(categoria: string): string {
  const tokens = (process.env.UAZAPI_INSTANCE_TOKENS || '').split(',').map(t => t.trim()).filter(Boolean);
  const owner = CATEGORIA_OWNER[categoria];
  if (owner && tokens.length > 1) {
    const idx = OWNER_TOKEN_MAP[owner];
    if (idx !== undefined && tokens[idx]) {
      return tokens[idx];
    }
  }
  // Fallback: token padrao
  return process.env.UAZAPI_TOKEN || '';
}

// --- Canais WhatsApp ---

export interface WhatsAppChannel {
  id: string;
  label: string;
  phone: string;
  provider: 'uazapi' | '360dialog';
}

export const WHATSAPP_CHANNELS: WhatsAppChannel[] = [
  { id: 'eeg', label: 'EEG', phone: '556192894339', provider: 'uazapi' },
  { id: 'recepcao', label: 'Recepção', phone: '556183008973', provider: 'uazapi' },
  { id: 'geral', label: 'Geral', phone: '556133455701', provider: '360dialog' },
];

export const GRUPO_CHANNELS: Record<string, string[]> = {
  eeg: ['eeg'],
  recepcao: ['recepcao', 'geral'],
  todos: ['eeg', 'recepcao', 'geral'],
};
