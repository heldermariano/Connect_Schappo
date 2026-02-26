import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

// Mapeamento grupo → categoria + provider padrão para novas conversas
const GRUPO_CONFIG: Record<string, { categoria: string; provider: string; owner: string }> = {
  recepcao: { categoria: 'recepcao', provider: 'uazapi', owner: '556183008973' },
  eeg: { categoria: 'eeg', provider: 'uazapi', owner: '556192894339' },
  geral: { categoria: 'geral', provider: '360dialog', owner: '556133455701' },
  todos: { categoria: 'geral', provider: '360dialog', owner: '556133455701' },
};

/**
 * POST /api/conversas/create — Cria ou retorna conversa existente para um telefone.
 * Body: { telefone: string, nome?: string }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const { telefone, nome, categoria: categoriaParam } = await request.json();

    if (!telefone || typeof telefone !== 'string') {
      return NextResponse.json({ error: 'telefone e obrigatorio' }, { status: 400 });
    }

    const tel = telefone.replace(/\D/g, '');
    if (!tel) {
      return NextResponse.json({ error: 'telefone invalido' }, { status: 400 });
    }

    // Determinar configuração do canal
    const grupo = (session.user as { grupo?: string }).grupo || 'todos';
    const config = categoriaParam && GRUPO_CONFIG[categoriaParam]
      ? GRUPO_CONFIG[categoriaParam]
      : (GRUPO_CONFIG[grupo] || GRUPO_CONFIG.todos);

    // Verificar se ja existe conversa para este telefone + categoria
    const existente = await pool.query(
      `SELECT id, wa_chatid, tipo, categoria, provider, telefone, nome_contato, nome_grupo, avatar_url,
              ultima_mensagem, ultima_msg_at, nao_lida, atendente_id, is_archived
       FROM atd.conversas WHERE telefone = $1 AND tipo = 'individual' AND categoria = $2 LIMIT 1`,
      [tel, config.categoria],
    );

    if (existente.rows.length > 0) {
      const conv = existente.rows[0];
      // Se esta arquivada, reabrir
      if (conv.is_archived) {
        await pool.query(
          `UPDATE atd.conversas SET is_archived = FALSE, updated_at = NOW() WHERE id = $1`,
          [conv.id],
        );
        conv.is_archived = false;
      }
      return NextResponse.json({ conversa: conv });
    }

    // Criar nova conversa usando upsert_conversa
    const waChatId = `${tel}@s.whatsapp.net`;

    const result = await pool.query(
      `SELECT atd.upsert_conversa($1, 'individual', $2, $3, $4, NULL, $5) AS id`,
      [waChatId, config.categoria, config.provider, nome || null, tel],
    );

    const conversaId = result.rows[0].id;

    // Buscar conversa completa para retornar
    const conversa = await pool.query(
      `SELECT id, wa_chatid, tipo, categoria, provider, telefone, nome_contato, nome_grupo, avatar_url,
              ultima_mensagem, ultima_msg_at, nao_lida, atendente_id
       FROM atd.conversas WHERE id = $1`,
      [conversaId],
    );

    return NextResponse.json({ conversa: conversa.rows[0] });
  } catch (err) {
    console.error('[api/conversas/create] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
