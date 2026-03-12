import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import { sendTemplate360Dialog } from '@/lib/whatsapp-provider';
import {
  saveOutgoingMessage,
  updateConversaAfterSend,
  broadcastNewMessage,
  generateMessageId,
  buildSendMetadata,
} from '@/lib/conversa-update';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

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

    const sendResult = await sendTemplate360Dialog(to, {
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

    const waMessageId = sendResult.messageId || generateMessageId('sent_tpl');
    console.log(`[send-template] OK: messageId=${waMessageId} conversa=${conversa_id}`);

    // Texto espelho do template para exibicao no painel
    const textoLocal = `Clínica Schappo - Confirmação de Agendamento\n\nOlá, ${nome_paciente}!\n\n• Data: ${data}\n• Horário: ${hora}\n• Médico(a): ${nome_medico}\n• Procedimento: ${procedimento}\n\nPor favor, selecione uma opção abaixo:\n[Confirmar] [Desmarcar] [Reagendar]`;

    const meta = buildSendMetadata(auth.session.user.id, auth.session.user.nome, sendResult, {
      source: 'template_manual',
      template_name: 'confirmacao_agendamento',
      nome_paciente,
      data,
      hora,
      nome_medico,
      procedimento,
    });

    const mensagem = await saveOutgoingMessage(pool, {
      conversa_id,
      wa_message_id: waMessageId,
      tipo_mensagem: 'template',
      conteudo: textoLocal,
      sender_name: auth.session.user.nome,
      categoria: conversa.categoria,
      metadata: meta,
    });

    if (!mensagem) {
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    await updateConversaAfterSend(pool, conversa_id, textoLocal);
    broadcastNewMessage(conversa_id, mensagem, conversa.categoria, conversa.tipo);

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/send-template] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
