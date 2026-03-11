import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

const TEMPLATE_NAME = 'confirmacao_agendamento';
const TEMPLATE_LANG = 'pt_BR';

async function sendTemplate360(
  to: string,
  params: { nome_paciente: string; data: string; hora: string; nome_medico: string; procedimento: string },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!url || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    const res = await fetch(`${url}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: TEMPLATE_LANG },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: params.nome_paciente },
                { type: 'text', text: params.data },
                { type: 'text', text: params.hora },
                { type: 'text', text: params.nome_medico },
                { type: 'text', text: params.procedimento },
              ],
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[send-template/360dialog] Erro:', res.status, body);
      return { success: false, error: `360Dialog ${res.status}: ${body.substring(0, 200)}` };
    }

    const data = await res.json();
    const messageId = data.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    console.error('[send-template/360dialog] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com 360Dialog' };
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const { conversa_id, nome_paciente, data, hora, nome_medico, procedimento } = await request.json();

    if (!conversa_id || !nome_paciente || !data || !hora || !nome_medico || !procedimento) {
      return NextResponse.json({ error: 'Todos os campos sao obrigatorios' }, { status: 400 });
    }

    // Buscar conversa
    const conversaResult = await pool.query(
      `SELECT id, wa_chatid, tipo, categoria, provider, telefone, nome_contato
       FROM atd.conversas WHERE id = $1`,
      [conversa_id],
    );

    if (conversaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const conversa = conversaResult.rows[0];

    if (conversa.provider !== '360dialog') {
      return NextResponse.json({ error: 'Templates so sao suportados via 360Dialog' }, { status: 400 });
    }

    const to = conversa.wa_chatid.replace('@s.whatsapp.net', '').replace('@g.us', '');

    const sendResult = await sendTemplate360(to, {
      nome_paciente,
      data,
      hora,
      nome_medico,
      procedimento,
    });

    if (!sendResult.success) {
      console.error(`[send-template] Falha: ${sendResult.error} conversa=${conversa_id}`);
      return NextResponse.json({ error: sendResult.error }, { status: 502 });
    }

    const waMessageId = sendResult.messageId || `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[send-template] OK: messageId=${waMessageId} conversa=${conversa_id}`);

    // Texto espelho do template para exibicao no painel
    const textoLocal = `Clínica Schappo - Confirmação de Agendamento\n\nOlá, ${nome_paciente}!\n\n• Data: ${data}\n• Horário: ${hora}\n• Médico(a): ${nome_medico}\n• Procedimento: ${procedimento}\n\nPor favor, selecione uma opção abaixo:\n[Confirmar] [Desmarcar] [Reagendar]`;

    const meta = JSON.stringify({
      source: 'template_manual',
      template_name: TEMPLATE_NAME,
      provider: '360dialog',
      sent_by: session.user.id,
      sent_by_name: session.user.nome,
    });

    const msgResult = await pool.query(
      `INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me, sender_phone, sender_name,
        tipo_mensagem, conteudo, status, metadata
      ) VALUES ($1, $2, true, $3, $4, 'text', $5, 'sent', $6)
      ON CONFLICT (wa_message_id) DO NOTHING
      RETURNING *`,
      [
        conversa_id,
        waMessageId,
        '556133455701',
        session.user.nome,
        textoLocal,
        meta,
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
        ultima_msg_from_me = TRUE,
        nao_lida = 0,
        updated_at = NOW()
       WHERE id = $2`,
      [textoLocal, conversa_id],
    );

    // SSE
    sseManager.broadcast({
      type: 'nova_mensagem',
      data: { conversa_id, mensagem, categoria: conversa.categoria, tipo: conversa.tipo },
    });
    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: {
        conversa_id,
        ultima_msg: textoLocal.substring(0, 200),
        nao_lida: 0,
        ultima_msg_from_me: true,
      },
    });

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/send-template] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
