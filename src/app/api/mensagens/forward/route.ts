import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { CATEGORIA_OWNER, getUazapiToken, normalizePhone, extractUazapiMessageIds } from '@/lib/types';

const GRUPO_CATEGORIAS: Record<string, string[]> = {
  recepcao: ['recepcao', 'geral'],
  eeg: ['eeg'],
  todos: ['eeg', 'recepcao', 'geral'],
};

// Envia texto via UAZAPI
async function sendTextUAZAPI(number: string, text: string, instanceToken: string): Promise<{ success: boolean; messageId?: string; fullMessageId?: string; error?: string }> {
  const url = process.env.UAZAPI_URL;
  const token = instanceToken;
  if (!url || !token) return { success: false, error: 'UAZAPI nao configurado' };

  try {
    const res = await fetch(`${url}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) return { success: false, error: `UAZAPI ${res.status}` };
    const data = await res.json();
    const ids = extractUazapiMessageIds(data);
    return { success: true, messageId: ids.shortId, fullMessageId: ids.fullId };
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
    const { source_message_id, target_conversa_id } = await request.json();

    if (!source_message_id || !target_conversa_id) {
      return NextResponse.json({ error: 'source_message_id e target_conversa_id sao obrigatorios' }, { status: 400 });
    }

    // Buscar mensagem original
    const msgResult = await pool.query(
      `SELECT * FROM atd.mensagens WHERE id = $1`,
      [source_message_id],
    );
    if (msgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem nao encontrada' }, { status: 404 });
    }
    const originalMsg = msgResult.rows[0];

    // Buscar conversa destino
    const conversaResult = await pool.query(
      `SELECT id, wa_chatid, tipo, categoria, provider, telefone
       FROM atd.conversas WHERE id = $1`,
      [target_conversa_id],
    );
    if (conversaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa destino nao encontrada' }, { status: 404 });
    }
    const conversa = conversaResult.rows[0];

    // Verificar permissao
    const grupo = (session.user as { grupo?: string }).grupo || 'todos';
    const categoriasPermitidas = GRUPO_CATEGORIAS[grupo] || GRUPO_CATEGORIAS.todos;
    if (!categoriasPermitidas.includes(conversa.categoria)) {
      return NextResponse.json({ error: 'Sem permissao para esta conversa' }, { status: 403 });
    }

    const isGroup = conversa.tipo === 'grupo';
    const destinatario = isGroup
      ? conversa.wa_chatid
      : conversa.wa_chatid.replace('@s.whatsapp.net', '');

    // Montar texto encaminhado
    const senderLabel = originalMsg.sender_name || originalMsg.sender_phone || 'Desconhecido';
    const conteudoOriginal = originalMsg.conteudo || `[${originalMsg.tipo_mensagem}]`;
    const nomeOperador = session.user.nome;
    const textToSend = `*${nomeOperador}:*\n_Encaminhada de ${senderLabel}:_\n${conteudoOriginal}`;

    // Enviar via provider
    let sendResult: { success: boolean; messageId?: string; fullMessageId?: string; error?: string };
    if (conversa.provider === '360dialog') {
      const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
      sendResult = await sendText360(to, textToSend);
    } else {
      const uazapiToken = getUazapiToken(conversa.categoria);
      sendResult = await sendTextUAZAPI(destinatario, textToSend, uazapiToken);
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Falha ao encaminhar' }, { status: 502 });
    }

    // Salvar no banco
    const owner = CATEGORIA_OWNER[conversa.categoria] || '';
    const waMessageId = sendResult.messageId || `fwd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newMsgResult = await pool.query(
      `INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me, sender_phone, sender_name,
        tipo_mensagem, conteudo, is_forwarded, status, metadata
      ) VALUES ($1, $2, true, $3, $4, 'text', $5, true, 'sent', $6)
      ON CONFLICT (wa_message_id) DO NOTHING
      RETURNING *`,
      [
        target_conversa_id,
        waMessageId,
        owner,
        session.user.nome,
        conteudoOriginal,
        JSON.stringify({
          forwarded_from_msg_id: source_message_id,
          forwarded_by: session.user.id,
          forwarded_by_name: session.user.nome,
          original_sender: senderLabel,
          message_id_full: sendResult.fullMessageId || waMessageId,
        }),
      ],
    );

    if (newMsgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    const mensagem = newMsgResult.rows[0];

    // Atualizar conversa destino
    await pool.query(
      `UPDATE atd.conversas SET
        ultima_mensagem = LEFT($1, 200),
        ultima_msg_at = NOW(),
        nao_lida = 0,
        updated_at = NOW()
       WHERE id = $2`,
      [conteudoOriginal, target_conversa_id],
    );

    // Emitir SSE
    sseManager.broadcast({
      type: 'nova_mensagem',
      data: { conversa_id: target_conversa_id, mensagem },
    });

    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: {
        conversa_id: target_conversa_id,
        ultima_msg: conteudoOriginal.substring(0, 200),
        nao_lida: 0,
      },
    });

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/forward] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
