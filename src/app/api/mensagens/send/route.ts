import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUazapiToken } from '@/lib/types';
import { requireAuth, isAuthed, apiError } from '@/lib/api-auth';
import { sendTextUAZAPI, sendText360Dialog } from '@/lib/whatsapp-provider';
import {
  type SendResult,
  saveOutgoingMessage,
  updateConversaAfterSend,
  broadcastNewMessage,
  formatRecipient,
  generateMessageId,
  buildSendMetadata,
} from '@/lib/conversa-update';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { conversa_id, conteudo, mencoes, quoted_msg_id } = await request.json();
    console.log(`[send] Inicio: conversa=${conversa_id} user=${auth.session.user.nome}`);

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
    if (!auth.categoriasPermitidas.includes(conversa.categoria)) {
      return apiError('Sem permissao para esta conversa', 403);
    }

    // Determinar destinatario — usar wa_chatid (JID real do WhatsApp) para garantir
    // que o numero nao sofra normalizacao incorreta (ex: 12 vs 13 digitos BR)
    const dest = formatRecipient(conversa.wa_chatid, conversa.tipo, conversa.provider);

    // Enviar via provider correto
    let sendResult: SendResult;

    // Prefixar nome do operador em negrito (visivel no WhatsApp)
    const nomeOperador = auth.session.user.nome;
    const textToSend = `*${nomeOperador}:*\n${conteudo.trim()}`;

    // Converter identificadores em JIDs do WhatsApp para mencoes
    // Podem ser telefones (5561...) ou LIDs (125786891759786)
    const mentionedJid = mencoesArray.length > 0
      ? mencoesArray.map((id) => {
          if (id.includes('@')) return id; // Ja eh JID completo
          const clean = id.replace(/\D/g, '');
          // LIDs sao tipicamente >13 digitos e nao comecam com 55 (DDI Brasil)
          // Telefones brasileiros tem 12-13 digitos e comecam com 55
          const isLikelyLid = clean.length >= 10 && !clean.startsWith('55');
          return isLikelyLid ? `${clean}@lid` : `${clean}@s.whatsapp.net`;
        })
      : undefined;

    console.log(`[send] Provider=${conversa.provider} categoria=${conversa.categoria} dest=${dest}`);

    if (conversa.provider === '360dialog') {
      console.log(`[send] 360Dialog: to=${dest}`);
      sendResult = await sendText360Dialog(dest, textToSend);
    } else {
      // UAZAPI: aceita numero ou chatid — usar token da instancia correta
      // replyid usa wa_message_id curto (sem prefixo owner) conforme doc UAZAPI
      const uazapiToken = getUazapiToken(conversa.categoria);
      sendResult = await sendTextUAZAPI(dest, textToSend, uazapiToken, mentionedJid, quoted_msg_id || undefined);
    }

    // Salvar mensagem no banco (mesmo em caso de falha, para permitir reenvio)
    const waMessageId = sendResult.messageId || generateMessageId('sent');
    const msgStatus = sendResult.success ? 'sent' : 'failed';

    if (!sendResult.success) {
      console.error(`[send] Falha: ${sendResult.error} provider=${conversa.provider} conversa=${conversa_id}`);
    } else {
      console.log(`[send] OK: messageId=${sendResult.messageId} provider=${conversa.provider}`);
    }

    const metadata = buildSendMetadata(auth.session.user.id, auth.session.user.nome, sendResult);
    const mensagem = await saveOutgoingMessage(pool, {
      conversa_id,
      wa_message_id: waMessageId,
      tipo_mensagem: 'text',
      conteudo: conteudo.trim(),
      sender_name: auth.session.user.nome,
      categoria: conversa.categoria,
      status: msgStatus,
      metadata,
      mencoes: mencoesArray,
      quoted_msg_id: quoted_msg_id || null,
    });

    if (!mensagem) {
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    // Emitir SSE (nova_mensagem sempre — para mostrar no painel, inclusive com status failed)
    broadcastNewMessage(conversa_id, mensagem, conversa.categoria, conversa.tipo);

    if (sendResult.success) {
      // Atualizar conversa apenas quando envio foi bem-sucedido
      await updateConversaAfterSend(pool, conversa_id, conteudo.trim());
      return NextResponse.json({ success: true, mensagem });
    } else {
      // Envio falhou mas mensagem foi salva com status 'failed' — retornar a mensagem para UI mostrar botao reenviar
      return NextResponse.json({ success: false, error: sendResult.error, mensagem }, { status: 502 });
    }
  } catch (err) {
    console.error('[api/mensagens/send] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
