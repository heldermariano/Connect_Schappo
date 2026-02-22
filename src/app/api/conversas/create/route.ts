import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

// Mapeamento grupo → categoria + provider padrão para novas conversas
const GRUPO_CONFIG: Record<string, { categoria: string; provider: string; owner: string }> = {
  recepcao: { categoria: 'recepcao', provider: 'uazapi', owner: '556183008973' },
  eeg: { categoria: 'eeg', provider: 'uazapi', owner: '556192894339' },
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
    const { telefone, nome } = await request.json();

    if (!telefone || typeof telefone !== 'string') {
      return NextResponse.json({ error: 'telefone e obrigatorio' }, { status: 400 });
    }

    const tel = telefone.replace(/\D/g, '');
    if (!tel) {
      return NextResponse.json({ error: 'telefone invalido' }, { status: 400 });
    }

    // Verificar se ja existe conversa para este telefone
    const existente = await pool.query(
      `SELECT id, wa_chatid, tipo, categoria, provider, telefone, nome_contato, nome_grupo, avatar_url,
              ultima_mensagem, ultima_msg_at, nao_lida, atendente_id
       FROM atd.conversas WHERE telefone = $1 AND tipo = 'individual' LIMIT 1`,
      [tel],
    );

    if (existente.rows.length > 0) {
      return NextResponse.json({ conversa: existente.rows[0] });
    }

    // Criar nova conversa usando upsert_conversa
    const grupo = (session.user as { grupo?: string }).grupo || 'todos';
    const config = GRUPO_CONFIG[grupo] || GRUPO_CONFIG.todos;
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
