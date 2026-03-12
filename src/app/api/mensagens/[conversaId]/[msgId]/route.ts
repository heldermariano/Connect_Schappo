import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { getUazapiToken } from '@/lib/types';

// Editar mensagem via UAZAPI
async function editViaUAZAPI(waMessageId: string, newText: string, instanceToken: string): Promise<{ success: boolean; error?: string }> {
  const url = process.env.UAZAPI_URL;
  if (!url || !instanceToken) {
    return { success: false, error: 'UAZAPI nao configurado' };
  }

  try {
    const res = await fetch(`${url}/message/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: instanceToken,
      },
      body: JSON.stringify({ id: waMessageId, text: newText }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[edit/uazapi] Erro:', res.status, body);
      return { success: false, error: `UAZAPI retornou ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error('[edit/uazapi] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com UAZAPI' };
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversaId: string; msgId: string }> },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const { conversaId, msgId } = await params;
  const cId = parseInt(conversaId, 10);
  const mId = parseInt(msgId, 10);
  if (isNaN(cId) || isNaN(mId)) {
    return NextResponse.json({ error: 'IDs invalidos' }, { status: 400 });
  }

  try {
    const { conteudo } = await request.json();
    if (!conteudo || typeof conteudo !== 'string' || !conteudo.trim()) {
      return NextResponse.json({ error: 'conteudo eh obrigatorio' }, { status: 400 });
    }

    // Buscar mensagem + conversa
    const msgResult = await pool.query(
      `SELECT m.*, c.categoria, c.provider
       FROM atd.mensagens m
       JOIN atd.conversas c ON c.id = m.conversa_id
       WHERE m.id = $1 AND m.conversa_id = $2`,
      [mId, cId],
    );

    if (msgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem nao encontrada' }, { status: 404 });
    }

    const msg = msgResult.rows[0];

    // Validar: apenas mensagens proprias de texto
    if (!msg.from_me) {
      return NextResponse.json({ error: 'So eh possivel editar mensagens proprias' }, { status: 403 });
    }
    if (msg.tipo_mensagem !== 'text') {
      return NextResponse.json({ error: 'So eh possivel editar mensagens de texto' }, { status: 400 });
    }

    // Editar via provider (apenas UAZAPI suporta edicao)
    if (msg.provider === 'uazapi' && msg.wa_message_id) {
      const instanceToken = getUazapiToken(msg.categoria);
      const editResult = await editViaUAZAPI(msg.wa_message_id, conteudo.trim(), instanceToken);
      if (!editResult.success) {
        console.warn('[edit] UAZAPI falhou, atualizando apenas local:', editResult.error);
      }
    }

    // Atualizar no banco
    const updated = await pool.query(
      `UPDATE atd.mensagens
       SET conteudo = $1, is_edited = true, edited_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [conteudo.trim(), mId],
    );

    const mensagem = updated.rows[0];

    // Atualizar ultima_mensagem da conversa se for a msg mais recente
    await pool.query(
      `UPDATE atd.conversas
       SET ultima_mensagem = LEFT($1, 200), updated_at = NOW()
       WHERE id = $2
         AND ultima_msg_at <= (SELECT created_at FROM atd.mensagens WHERE id = $3)`,
      [conteudo.trim(), cId, mId],
    );

    // Broadcast SSE
    sseManager.broadcast({
      type: 'mensagem_editada' as 'conversa_atualizada',
      data: { conversa_id: cId, mensagem } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
    });

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/PATCH] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ conversaId: string; msgId: string }> },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const { conversaId, msgId } = await params;
  const cId = parseInt(conversaId, 10);
  const mId = parseInt(msgId, 10);
  if (isNaN(cId) || isNaN(mId)) {
    return NextResponse.json({ error: 'IDs invalidos' }, { status: 400 });
  }

  const isAdmin = auth.session.user.role === 'admin';
  const userId = auth.userId;

  try {
    // Buscar mensagem para verificar permissao
    const msgCheck = await pool.query(
      'SELECT id, from_me, sender_phone FROM atd.mensagens WHERE id = $1 AND conversa_id = $2',
      [mId, cId],
    );

    if (msgCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem nao encontrada' }, { status: 404 });
    }

    // Admin pode apagar qualquer mensagem; operador so pode apagar from_me
    if (!isAdmin && !msgCheck.rows[0].from_me) {
      return NextResponse.json({ error: 'Voce so pode apagar mensagens enviadas por voce' }, { status: 403 });
    }

    // Soft-delete: manter no banco para auditoria
    const result = await pool.query(
      `UPDATE atd.mensagens
       SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3
       WHERE id = $1 AND conversa_id = $2
       RETURNING id`,
      [mId, cId, userId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem nao encontrada' }, { status: 404 });
    }

    // Broadcast SSE para frontend remover a mensagem
    sseManager.broadcast({
      type: 'mensagem_removida' as 'conversa_atualizada',
      data: { conversa_id: cId, mensagem_id: mId } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/mensagens/DELETE] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
