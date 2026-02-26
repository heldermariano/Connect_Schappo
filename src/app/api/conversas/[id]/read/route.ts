import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { getUazapiToken } from '@/lib/types';

// PATCH: Marcar conversa como lida (zerar nao_lida + tick azul no WhatsApp)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const conversaId = parseInt(id);
  if (isNaN(conversaId)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  try {
    // Verificar se o body pede marcar como nao lida
    let unread = false;
    try {
      const body = await request.json();
      unread = body?.unread === true;
    } catch {
      // Body vazio = marcar como lida (padrao)
    }

    const result = await pool.query(
      unread
        ? `UPDATE atd.conversas SET nao_lida = 1, updated_at = NOW() WHERE id = $1 RETURNING id, ultima_mensagem, categoria, provider`
        : `UPDATE atd.conversas SET nao_lida = 0, updated_at = NOW() WHERE id = $1 RETURNING id, ultima_mensagem, categoria, provider`,
      [conversaId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const conversa = result.rows[0];

    // Marcar como lida no WhatsApp via UAZAPI (tick azul) — so se marcando como lida
    if (!unread && conversa.provider === 'uazapi') {
      markReadOnWhatsApp(conversaId, conversa.categoria).catch((err) =>
        console.error('[api/conversas/read] Erro ao marcar lida no WhatsApp:', err),
      );
    }

    // Emitir SSE para atualizar outros clientes
    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: {
        conversa_id: conversaId,
        ultima_msg: conversa.ultima_mensagem || '',
        nao_lida: unread ? 1 : 0,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/conversas/read] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Envia markread para UAZAPI (nao bloqueia a resposta)
async function markReadOnWhatsApp(conversaId: number, categoria: string) {
  const url = process.env.UAZAPI_URL;
  const token = getUazapiToken(categoria);
  if (!url || !token) return;

  // Buscar as ultimas mensagens nao lidas (from_me = false) para marcar como lida
  const msgs = await pool.query(
    `SELECT wa_message_id FROM atd.mensagens
     WHERE conversa_id = $1 AND from_me = false
     ORDER BY id DESC LIMIT 10`,
    [conversaId],
  );

  const ids = msgs.rows
    .map((m) => m.wa_message_id)
    .filter((id) => id && !id.startsWith('sent_') && !id.startsWith('reaction_'));

  if (ids.length === 0) return;

  try {
    await fetch(`${url}/message/markread`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ id: ids }),
    });
  } catch {
    // Silenciar — nao eh critico
  }
}
