import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

// PATCH: Atribuir atendente a uma conversa
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
    const { atendente_id, reabrir } = await request.json();

    // Reabrir conversa arquivada (busca → abrir conversa resolvida)
    if (reabrir) {
      const result = await pool.query(
        `UPDATE atd.conversas SET is_archived = FALSE, updated_at = NOW()
         WHERE id = $1 RETURNING id, ultima_mensagem, nao_lida, atendente_id`,
        [conversaId],
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
      }
      sseManager.broadcast({
        type: 'conversa_atualizada',
        data: { conversa_id: conversaId, is_archived: false },
      });
      return NextResponse.json({ success: true });
    }

    // atendente_id null = desatribuir
    if (atendente_id !== null && atendente_id !== undefined) {
      // Verificar se atendente existe e esta ativo
      const atendenteResult = await pool.query(
        `SELECT id, nome FROM atd.atendentes WHERE id = $1 AND ativo = true`,
        [atendente_id],
      );
      if (atendenteResult.rows.length === 0) {
        return NextResponse.json({ error: 'Atendente nao encontrado ou inativo' }, { status: 404 });
      }
    }

    // Se atendente_id = null → finalizando atendimento → arquivar conversa
    const isFinalizando = !atendente_id;

    const result = await pool.query(
      `UPDATE atd.conversas SET atendente_id = $1, is_archived = $3, updated_at = NOW()
       WHERE id = $2 RETURNING id, ultima_mensagem, nao_lida, atendente_id`,
      [atendente_id || null, conversaId, isFinalizando],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const conversa = result.rows[0];

    // Buscar nome do atendente para o SSE
    let atendente_nome: string | null = null;
    if (conversa.atendente_id) {
      const atendenteRes = await pool.query(
        `SELECT nome FROM atd.atendentes WHERE id = $1`,
        [conversa.atendente_id],
      );
      atendente_nome = atendenteRes.rows[0]?.nome || null;
    }

    // Emitir SSE
    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: {
        conversa_id: conversaId,
        ultima_msg: conversa.ultima_mensagem || '',
        nao_lida: conversa.nao_lida,
        atendente_id: conversa.atendente_id,
        atendente_nome,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/conversas/atribuir] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
