import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { CATEGORIA_OWNER, getUazapiToken, normalizePhone } from '@/lib/types';

const GRUPO_CATEGORIAS: Record<string, string[]> = {
  recepcao: ['recepcao', 'geral'],
  eeg: ['eeg'],
  todos: ['eeg', 'recepcao', 'geral'],
};

// Envia texto via UAZAPI
async function sendTextUAZAPI(number: string, text: string, instanceToken: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = process.env.UAZAPI_URL;
  if (!url || !instanceToken) return { success: false, error: 'UAZAPI nao configurado' };

  try {
    const res = await fetch(`${url}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) return { success: false, error: `UAZAPI ${res.status}` };
    const data = await res.json();
    return { success: true, messageId: data.id || data.messageid || data.messageId };
  } catch {
    return { success: false, error: 'Erro de conexao UAZAPI' };
  }
}

// Envia texto via 360Dialog
async function sendText360(to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiUrl = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!apiUrl || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    const res = await fetch(`${apiUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    if (!res.ok) return { success: false, error: `360Dialog ${res.status}` };
    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch {
    return { success: false, error: 'Erro de conexao 360Dialog' };
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const { mensagem_id } = await request.json();

    if (!mensagem_id) {
      return NextResponse.json({ error: 'mensagem_id e obrigatorio' }, { status: 400 });
    }

    // Buscar mensagem original com dados da conversa
    const msgResult = await pool.query(
      `SELECT m.*, c.wa_chatid, c.tipo, c.categoria, c.provider, c.telefone
       FROM atd.mensagens m
       JOIN atd.conversas c ON c.id = m.conversa_id
       WHERE m.id = $1`,
      [mensagem_id],
    );

    if (msgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem nao encontrada' }, { status: 404 });
    }

    const original = msgResult.rows[0];

    // Apenas mensagens proprias podem ser reenviadas
    if (!original.from_me) {
      return NextResponse.json({ error: 'Somente mensagens proprias podem ser reenviadas' }, { status: 403 });
    }

    // Verificar permissao do grupo
    const grupo = (session.user as { grupo?: string }).grupo || 'todos';
    const categoriasPermitidas = GRUPO_CATEGORIAS[grupo] || GRUPO_CATEGORIAS.todos;
    if (!categoriasPermitidas.includes(original.categoria)) {
      return NextResponse.json({ error: 'Sem permissao para esta conversa' }, { status: 403 });
    }

    // Determinar destinatario
    const isGroup = original.tipo === 'grupo';
    const rawDest = original.telefone || original.wa_chatid.replace('@s.whatsapp.net', '');
    const destinatario = isGroup
      ? original.wa_chatid
      : (normalizePhone(rawDest) || rawDest);

    // Montar texto para reenvio
    const conteudoOriginal = original.conteudo || `[${original.tipo_mensagem}]`;
    const nomeOperador = session.user.nome;
    const textToSend = `*${nomeOperador}:*\n${conteudoOriginal}`;

    // Enviar via provider correto
    let sendResult: { success: boolean; messageId?: string; error?: string };

    if (original.provider === '360dialog') {
      const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
      sendResult = await sendText360(to, textToSend);
    } else {
      const uazapiToken = getUazapiToken(original.categoria);
      sendResult = await sendTextUAZAPI(destinatario, textToSend, uazapiToken);
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Falha ao reenviar' }, { status: 502 });
    }

    // Salvar nova mensagem no banco
    const owner = CATEGORIA_OWNER[original.categoria] || '';
    const waMessageId = sendResult.messageId || `resend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newMsgResult = await pool.query(
      `INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me, sender_phone, sender_name,
        tipo_mensagem, conteudo, status, metadata
      ) VALUES ($1, $2, true, $3, $4, 'text', $5, 'sent', $6)
      ON CONFLICT (wa_message_id) DO NOTHING
      RETURNING *`,
      [
        original.conversa_id,
        waMessageId,
        owner,
        session.user.nome,
        conteudoOriginal,
        JSON.stringify({
          sent_by: session.user.id,
          sent_by_name: session.user.nome,
          resent_from: mensagem_id,
        }),
      ],
    );

    if (newMsgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    const mensagem = newMsgResult.rows[0];

    // Marcar original com info de reenvio
    await pool.query(
      `UPDATE atd.mensagens SET metadata = metadata || $1 WHERE id = $2`,
      [JSON.stringify({ resent_at: new Date().toISOString(), resent_by: session.user.nome }), mensagem_id],
    );

    // Atualizar conversa
    await pool.query(
      `UPDATE atd.conversas SET
        ultima_mensagem = LEFT($1, 200),
        ultima_msg_at = NOW(),
        ultima_msg_from_me = TRUE,
        nao_lida = 0,
        updated_at = NOW()
       WHERE id = $2`,
      [conteudoOriginal, original.conversa_id],
    );

    // Emitir SSE
    sseManager.broadcast({
      type: 'nova_mensagem',
      data: { conversa_id: original.conversa_id, mensagem, categoria: original.categoria, tipo: original.tipo },
    });

    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: {
        conversa_id: original.conversa_id,
        ultima_msg: conteudoOriginal.substring(0, 200),
        nao_lida: 0,
      },
    });

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/resend] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
