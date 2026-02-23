import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

// Mapeamento categoria → owner (numero que envia)
const CATEGORIA_OWNER: Record<string, string> = {
  eeg: '556192894339',
  recepcao: '556183008973',
  geral: '556133455701',
};

// Categorias permitidas por grupo de atendimento
const GRUPO_CATEGORIAS: Record<string, string[]> = {
  recepcao: ['recepcao', 'geral'],
  eeg: ['eeg'],
  todos: ['eeg', 'recepcao', 'geral'],
};

// Envia mensagem via UAZAPI
async function sendViaUAZAPI(number: string, text: string, mentionedJid?: string[], quotedMsgId?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = process.env.UAZAPI_URL;
  const token = process.env.UAZAPI_TOKEN;

  if (!url || !token) {
    return { success: false, error: 'UAZAPI nao configurado' };
  }

  try {
    const payload: Record<string, unknown> = { number, text };
    if (mentionedJid && mentionedJid.length > 0) {
      payload.mentionedJid = mentionedJid;
    }
    if (quotedMsgId) {
      payload.quoted = quotedMsgId;
    }

    const res = await fetch(`${url}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[send/uazapi] Erro:', res.status, body);
      return { success: false, error: `UAZAPI retornou ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.id || data.messageid || data.messageId };
  } catch (err) {
    console.error('[send/uazapi] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com UAZAPI' };
  }
}

// Envia mensagem via 360Dialog (Meta Cloud API format)
async function sendVia360Dialog(to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;

  if (!url || !apiKey) {
    return { success: false, error: '360Dialog nao configurado' };
  }

  try {
    const res = await fetch(`${url}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': apiKey,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[send/360dialog] Erro:', res.status, body);
      return { success: false, error: `360Dialog retornou ${res.status}` };
    }

    const data = await res.json();
    const messageId = data.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    console.error('[send/360dialog] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com 360Dialog' };
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const { conversa_id, conteudo, mencoes, quoted_msg_id } = await request.json();

    if (!conversa_id || !conteudo || typeof conteudo !== 'string' || !conteudo.trim()) {
      return NextResponse.json({ error: 'conversa_id e conteudo sao obrigatorios' }, { status: 400 });
    }

    // Validar mencoes (array opcional de telefones)
    const mencoesArray: string[] = Array.isArray(mencoes) ? mencoes.filter((m: unknown) => typeof m === 'string') : [];

    // Buscar conversa no banco
    const conversaResult = await pool.query(
      `SELECT id, wa_chatid, tipo, categoria, provider, telefone, nome_contato
       FROM atd.conversas WHERE id = $1`,
      [conversa_id],
    );

    if (conversaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const conversa = conversaResult.rows[0];

    // Verificar permissao do atendente
    const grupo = (session.user as { grupo?: string }).grupo || 'todos';
    const categoriasPermitidas = GRUPO_CATEGORIAS[grupo] || GRUPO_CATEGORIAS.todos;
    if (!categoriasPermitidas.includes(conversa.categoria)) {
      return NextResponse.json({ error: 'Sem permissao para esta conversa' }, { status: 403 });
    }

    // Determinar destinatario
    const isGroup = conversa.tipo === 'grupo';
    let destinatario: string;

    if (isGroup) {
      // Grupo: usar wa_chatid (ex: 120363xxx@g.us)
      destinatario = conversa.wa_chatid;
    } else {
      // Individual: usar telefone ou extrair do wa_chatid
      destinatario = conversa.telefone || conversa.wa_chatid.replace('@s.whatsapp.net', '');
    }

    // Enviar via provider correto
    let sendResult: { success: boolean; messageId?: string; error?: string };

    // Prefixar nome do operador em negrito (visivel no WhatsApp)
    const nomeOperador = session.user.nome;
    const textToSend = `*${nomeOperador}:*\n${conteudo.trim()}`;

    // Converter telefones em JIDs do WhatsApp para mencoes
    const mentionedJid = mencoesArray.length > 0
      ? mencoesArray.map((phone) => {
          const clean = phone.replace(/\D/g, '');
          return clean.includes('@') ? clean : `${clean}@s.whatsapp.net`;
        })
      : undefined;

    if (conversa.provider === '360dialog') {
      // 360Dialog: numero sem @s.whatsapp.net
      const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
      sendResult = await sendVia360Dialog(to, textToSend);
    } else {
      // UAZAPI: aceita numero ou chatid
      sendResult = await sendViaUAZAPI(destinatario, textToSend, mentionedJid, quoted_msg_id);
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Falha ao enviar mensagem' }, { status: 502 });
    }

    // Salvar mensagem no banco
    const owner = CATEGORIA_OWNER[conversa.categoria] || '';
    const waMessageId = sendResult.messageId || `sent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const msgResult = await pool.query(
      `INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me, sender_phone, sender_name,
        tipo_mensagem, conteudo, status, metadata, mencoes, quoted_msg_id
      ) VALUES ($1, $2, true, $3, $4, 'text', $5, 'sent', $6, $7, $8)
      ON CONFLICT (wa_message_id) DO NOTHING
      RETURNING *`,
      [
        conversa_id,
        waMessageId,
        owner,
        session.user.nome,
        conteudo.trim(),
        JSON.stringify({ sent_by: session.user.id, sent_by_name: session.user.nome }),
        mencoesArray.length > 0 ? mencoesArray : '{}',
        quoted_msg_id || null,
      ],
    );

    if (msgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    const mensagem = msgResult.rows[0];

    // Atualizar conversa
    await pool.query(
      `UPDATE atd.conversas SET
        ultima_mensagem = LEFT($1, 200),
        ultima_msg_at = NOW(),
        nao_lida = 0,
        updated_at = NOW()
       WHERE id = $2`,
      [conteudo.trim(), conversa_id],
    );

    // Emitir SSE
    sseManager.broadcast({
      type: 'nova_mensagem',
      data: { conversa_id, mensagem },
    });

    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: {
        conversa_id,
        ultima_msg: conteudo.trim().substring(0, 200),
        nao_lida: 0,
      },
    });

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/send] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
