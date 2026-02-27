import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

// Categorias permitidas por grupo de atendimento
const GRUPO_CATEGORIAS: Record<string, string[]> = {
  recepcao: ['recepcao', 'geral'],
  eeg: ['eeg'],
  todos: ['eeg', 'recepcao', 'geral'],
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const grupo = (session.user as { grupo?: string }).grupo || 'todos';
  const categoriasPermitidas = GRUPO_CATEGORIAS[grupo] || GRUPO_CATEGORIAS.todos;

  const params = request.nextUrl.searchParams;
  const idParam = params.get('id'); // Buscar conversa por ID direto
  const categoria = params.get('categoria'); // 'eeg', 'recepcao', 'geral'
  const tipo = params.get('tipo'); // 'individual', 'grupo'
  const pendentes = params.get('pendentes'); // 'true' — filtrar não respondidas
  const busca = params.get('busca'); // Busca por nome/telefone
  const limit = Math.min(parseInt(params.get('limit') || '50'), 100);
  const offset = parseInt(params.get('offset') || '0');

  // Busca direta por ID (para pré-selecionar conversa via ?id=)
  if (idParam) {
    try {
      const result = await pool.query(
        `SELECT c.*, a.nome AS atendente_nome,
                COALESCE(ct.nome, c.nome_contato) AS nome_contato_display
         FROM atd.conversas c
         LEFT JOIN atd.atendentes a ON a.id = c.atendente_id
         LEFT JOIN atd.contatos ct ON ct.telefone = c.telefone AND ct.telefone IS NOT NULL AND ct.telefone != ''
         WHERE c.id = $1`,
        [parseInt(idParam, 10)],
      );
      const conversas = result.rows.map((row) => ({
        ...row,
        nome_contato: row.nome_contato_display || row.nome_contato,
      }));
      return NextResponse.json({ conversas, total: conversas.length, limit: 1, offset: 0 });
    } catch (err) {
      console.error('[api/conversas] Erro busca por id:', err);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
  }

  const historico = params.get('historico'); // 'true' — buscar conversas finalizadas
  const conditions: string[] = [];

  // Quando ha busca, nao filtrar por is_archived (buscar em tudo: ativas + resolvidas)
  // Caso contrario, respeitar filtro historico/ativo
  if (!busca) {
    conditions.push(historico === 'true' ? 'c.is_archived = TRUE' : 'c.is_archived = FALSE');
  }
  const values: unknown[] = [];
  let paramIndex = 1;

  // Filtro por grupo do atendente (server-side)
  if (grupo !== 'todos') {
    const placeholders = categoriasPermitidas.map(() => `$${paramIndex++}`);
    conditions.push(`c.categoria IN (${placeholders.join(', ')})`);
    values.push(...categoriasPermitidas);
  }

  if (categoria) {
    // Validar que a categoria solicitada esta dentro do escopo permitido
    if (!categoriasPermitidas.includes(categoria)) {
      return NextResponse.json({ conversas: [], total: 0, limit, offset });
    }
    conditions.push(`c.categoria = $${paramIndex++}`);
    values.push(categoria);
  }

  if (tipo) {
    conditions.push(`c.tipo = $${paramIndex++}`);
    values.push(tipo);
  }

  // Filtro de pendentes: não lidas + não respondidas pelo atendente
  if (pendentes === 'true') {
    conditions.push('c.nao_lida > 0');
    conditions.push('c.ultima_msg_from_me = FALSE');
  }

  if (busca) {
    // Busca em nome, telefone, nome do grupo e contato
    let buscaCondition = `(c.nome_contato ILIKE $${paramIndex} OR c.nome_grupo ILIKE $${paramIndex} OR c.telefone ILIKE $${paramIndex} OR ct.nome ILIKE $${paramIndex}`;

    // Busca profunda: incluir conteudo de mensagens (apenas para buscas >= 3 chars)
    if (busca.length >= 3) {
      buscaCondition += ` OR c.id IN (SELECT DISTINCT conversa_id FROM atd.mensagens WHERE conteudo ILIKE $${paramIndex} LIMIT 50)`;
    }

    buscaCondition += ')';
    conditions.push(buscaCondition);
    values.push(`%${busca}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  // Pendentes: ordenar por mais tempo de espera (mais antiga primeiro)
  const orderClause = pendentes === 'true'
    ? 'ORDER BY c.ultima_msg_at ASC NULLS LAST'
    : 'ORDER BY c.ultima_msg_at DESC NULLS LAST';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)
       FROM atd.conversas c
       LEFT JOIN atd.contatos ct ON ct.telefone = c.telefone AND ct.telefone IS NOT NULL AND ct.telefone != ''
       ${whereClause}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT c.*, a.nome AS atendente_nome,
              COALESCE(ct.nome, c.nome_contato) AS nome_contato_display
       FROM atd.conversas c
       LEFT JOIN atd.atendentes a ON a.id = c.atendente_id
       LEFT JOIN atd.contatos ct ON ct.telefone = c.telefone AND ct.telefone IS NOT NULL AND ct.telefone != ''
       ${whereClause}
       ${orderClause}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, limit, offset],
    );

    // Sobrescrever nome_contato com nome do contato salvo (se disponivel)
    const conversas = result.rows.map((row) => ({
      ...row,
      nome_contato: row.nome_contato_display || row.nome_contato,
    }));

    return NextResponse.json({
      conversas,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[api/conversas] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
