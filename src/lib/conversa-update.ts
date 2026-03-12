import { Pool } from 'pg';
import { sseManager } from './sse-manager';
import { CATEGORIA_OWNER, type Mensagem } from './types';

export interface SendResult {
  success: boolean;
  messageId?: string;
  fullMessageId?: string;
  mediaId?: string;
  error?: string;
}

export interface SaveMessageParams {
  conversa_id: number;
  wa_message_id: string;
  tipo_mensagem: string;
  conteudo: string;
  sender_name: string;
  categoria: string;
  status?: string;
  metadata?: Record<string, unknown>;
  mencoes?: string[];
  quoted_msg_id?: string | null;
  media_url?: string | null;
  media_mimetype?: string | null;
  media_filename?: string | null;
  is_forwarded?: boolean;
}

/**
 * Gera um wa_message_id unico para mensagens sem ID do provider.
 */
export function generateMessageId(prefix = 'sent'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Insere mensagem enviada no banco (idempotente via ON CONFLICT).
 * Retorna a mensagem inserida ou null se duplicada.
 */
export async function saveOutgoingMessage(
  pool: Pool,
  params: SaveMessageParams,
): Promise<Mensagem | null> {
  const owner = CATEGORIA_OWNER[params.categoria] || '';

  const result = await pool.query(
    `INSERT INTO atd.mensagens (
      conversa_id, wa_message_id, from_me, sender_phone, sender_name,
      tipo_mensagem, conteudo, status, metadata,
      mencoes, quoted_msg_id,
      media_url, media_mimetype, media_filename, is_forwarded
    ) VALUES ($1, $2, true, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (conversa_id, wa_message_id) DO NOTHING
    RETURNING *`,
    [
      params.conversa_id,
      params.wa_message_id,
      owner,
      params.sender_name,
      params.tipo_mensagem,
      params.conteudo,
      params.status || 'sent',
      params.metadata ? JSON.stringify(params.metadata) : '{}',
      params.mencoes && params.mencoes.length > 0 ? params.mencoes : '{}',
      params.quoted_msg_id || null,
      params.media_url || null,
      params.media_mimetype || null,
      params.media_filename || null,
      params.is_forwarded || false,
    ],
  );

  return result.rows.length > 0 ? (result.rows[0] as Mensagem) : null;
}

/**
 * Atualiza conversa apos envio bem-sucedido + broadcast SSE.
 */
export async function updateConversaAfterSend(
  pool: Pool,
  conversa_id: number,
  conteudo: string,
): Promise<void> {
  await pool.query(
    `UPDATE atd.conversas SET
      ultima_mensagem = LEFT($1, 200),
      ultima_msg_at = NOW(),
      ultima_msg_from_me = TRUE,
      nao_lida = 0,
      updated_at = NOW()
     WHERE id = $2`,
    [conteudo, conversa_id],
  );

  sseManager.broadcast({
    type: 'conversa_atualizada',
    data: {
      conversa_id,
      ultima_msg: conteudo.substring(0, 200),
      nao_lida: 0,
    },
  });
}

/**
 * Broadcast SSE de nova mensagem.
 */
export function broadcastNewMessage(
  conversa_id: number,
  mensagem: Mensagem,
  categoria: string,
  tipo?: string,
): void {
  sseManager.broadcast({
    type: 'nova_mensagem',
    data: { conversa_id, mensagem, categoria, tipo },
  });
}

/**
 * Formata destinatario conforme provider.
 */
export function formatRecipient(wa_chatid: string, tipo: string, provider: string): string {
  const isGroup = tipo === 'grupo';
  const raw = isGroup ? wa_chatid : wa_chatid.replace('@s.whatsapp.net', '');
  if (provider === '360dialog') {
    return raw.replace('@s.whatsapp.net', '').replace('@g.us', '');
  }
  return raw;
}

/**
 * Cria metadata padrao para mensagens enviadas.
 */
export function buildSendMetadata(
  userId: string,
  userName: string,
  sendResult: SendResult,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    sent_by: userId,
    sent_by_name: userName,
    message_id_full: sendResult.fullMessageId || sendResult.messageId || '',
    ...(sendResult.error ? { send_error: sendResult.error } : {}),
    ...(sendResult.mediaId ? { dialog360_media_id: sendResult.mediaId } : {}),
    ...extra,
  };
}
