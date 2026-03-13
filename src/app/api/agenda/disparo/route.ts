import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import { queryLatin1 } from '@/lib/db-agenda';
import pool from '@/lib/db';
import { normalizePhone, getUazapiToken, extractUazapiMessageIds } from '@/lib/types';
import { sseManager } from '@/lib/sse-manager';

// Delay entre envios (rate limit)
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Categoria usada para confirmacoes (numero da Recepcao)
const CONFIRMACAO_CATEGORIA = 'recepcao';

// Envia mensagem de confirmacao com botoes interativos via UAZAPI
async function sendConfirmacaoUAZAPI(
  to: string,
  params: { nome_paciente: string; data: string; hora: string; nome_medico: string; procedimento: string },
  instanceToken: string,
): Promise<{ success: boolean; messageId?: string; fullMessageId?: string; error?: string }> {
  const url = process.env.UAZAPI_URL;
  if (!url || !instanceToken) return { success: false, error: 'UAZAPI nao configurado' };

  const texto = `Clínica Schappo - Confirmação de Agendamento\n\nOlá, ${params.nome_paciente}!\n\n• Data: ${params.data}\n• Horário: ${params.hora}\n• Médico(a): ${params.nome_medico}\n• Procedimento: ${params.procedimento}\n\nPor favor, selecione uma opção abaixo:`;

  try {
    const res = await fetch(`${url}/send/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify({
        number: to,
        type: 'button',
        text: texto,
        choices: [
          'Confirmar|CONFIRMAR',
          'Desmarcar|DESMARCAR',
          'Reagendar|REAGENDAR',
        ],
        footerText: 'Clínica Schappo',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[disparo/uazapi] Erro menu:', res.status, body);
      return { success: false, error: `UAZAPI ${res.status}: ${body.substring(0, 200)}` };
    }

    const data = await res.json();
    const ids = extractUazapiMessageIds(data);
    return { success: true, messageId: ids.shortId, fullMessageId: ids.fullId };
  } catch (err) {
    console.error('[disparo/uazapi] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com UAZAPI' };
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { chaves, mensagem, medico_id, data } = await request.json();
    // mensagem param kept for API compat but template is fixed

    if (!chaves || !Array.isArray(chaves) || chaves.length === 0) {
      return NextResponse.json({ error: 'chaves eh obrigatorio (array)' }, { status: 400 });
    }
    if (!medico_id || !data) {
      return NextResponse.json({ error: 'medico_id e data sao obrigatorios' }, { status: 400 });
    }

    // Buscar dados dos agendamentos no banco externo
    const agendaResult = await queryLatin1(`
      SELECT
        a.chave, a.des_hora,
        a.des_procedimento::bytea as des_procedimento,
        p.cod_paciente,
        p.nom_paciente_completo::bytea as nom_paciente_completo,
        p.num_ddd1, p.num_telefone1,
        p.des_tipo_fone1::bytea as des_tipo_fone1,
        p.num_ddd2, p.num_telefone2,
        p.des_tipo_fone2::bytea as des_tipo_fone2,
        p.num_ddd3, p.num_telefone3,
        p.des_tipo_fone3::bytea as des_tipo_fone3,
        m.nom_medico::bytea as nom_medico,
        m.nom_guerra::bytea as nom_guerra
      FROM arq_agendal a
      LEFT JOIN arq_paciente p ON p.cod_paciente = a.cod_paciente
      LEFT JOIN arq_medico m ON m.id_medico = a.id_medico
      WHERE a.chave = ANY($1)
    `, [chaves.map((c: number) => c)],
    ['des_procedimento', 'nom_paciente_completo', 'des_tipo_fone1', 'des_tipo_fone2', 'des_tipo_fone3', 'nom_medico', 'nom_guerra']);

    const agendaMap = new Map<number, typeof agendaResult.rows[0]>();
    for (const row of agendaResult.rows) {
      agendaMap.set(row.chave, row);
    }

    const atendenteId = auth.userId;
    const instanceToken = getUazapiToken(CONFIRMACAO_CATEGORIA);

    const detalhes: Array<{
      chave: number;
      paciente: string;
      telefone: string | null;
      status: 'enviado' | 'falha' | 'sem_telefone';
      erro?: string;
    }> = [];

    let enviados = 0;
    let falhas = 0;
    let sem_telefone = 0;

    for (let i = 0; i < chaves.length; i++) {
      const chave = chaves[i];
      const agenda = agendaMap.get(chave);

      if (!agenda) {
        detalhes.push({ chave, paciente: '?', telefone: null, status: 'falha', erro: 'Agendamento nao encontrado' });
        falhas++;
        continue;
      }

      // Selecionar melhor telefone (priorizar celular)
      let telefoneWhatsapp: string | null = null;
      for (let t = 1; t <= 3; t++) {
        const ddd = agenda[`num_ddd${t}`] as string | null;
        const num = agenda[`num_telefone${t}`] as string | null;
        const tipo = ((agenda[`des_tipo_fone${t}`] as string) || '').trim().toLowerCase();
        if (ddd && num) {
          const normalized = normalizePhone(`${ddd.trim()}${num.trim().replace(/\D/g, '')}`);
          if (normalized && (tipo === 'celular' || tipo === 'cel' || !telefoneWhatsapp)) {
            telefoneWhatsapp = normalized;
            if (tipo === 'celular' || tipo === 'cel') break;
          }
        }
      }

      const pacienteNome = (agenda.nom_paciente_completo as string) || 'Paciente';

      if (!telefoneWhatsapp) {
        detalhes.push({ chave, paciente: pacienteNome, telefone: null, status: 'sem_telefone' });
        sem_telefone++;
        continue;
      }

      // Parametros do template
      const nomeMedico = (agenda.nom_guerra as string) || (agenda.nom_medico as string) || '';
      const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR');
      const hora = (agenda.des_hora as string) || '';
      const procedimento = (agenda.des_procedimento as string) || '';
      const primeiroNome = pacienteNome.split(' ')[0];

      // Texto local para exibicao no painel
      const textoLocal = `Clínica Schappo - Confirmação de Agendamento\n\nOlá, ${primeiroNome}!\n\n• Data: ${dataFormatada}\n• Horário: ${hora}\n• Médico(a): ${nomeMedico}\n• Procedimento: ${procedimento}\n\nPor favor, selecione uma opção abaixo:\n[Confirmar] [Desmarcar] [Reagendar]`;

      // Enviar via UAZAPI com botoes interativos (numero da Recepcao)
      try {
        const sendResult = await sendConfirmacaoUAZAPI(telefoneWhatsapp, {
          nome_paciente: primeiroNome,
          data: dataFormatada,
          hora,
          nome_medico: nomeMedico,
          procedimento,
        }, instanceToken);

        if (!sendResult.success) {
          console.error(`[disparo] Falha UAZAPI chave=${chave}:`, sendResult.error);
          detalhes.push({ chave, paciente: pacienteNome, telefone: telefoneWhatsapp, status: 'falha', erro: sendResult.error });
          falhas++;
          continue;
        }

        const waMessageId = sendResult.messageId || `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        console.log(`[disparo] UAZAPI OK chave=${chave} to=${telefoneWhatsapp} msgId=${waMessageId}`);

        // Registrar no banco local
        await pool.query(
          `INSERT INTO atd.confirmacao_agendamento
           (chave_agenda, cod_paciente, id_medico, dat_agenda, telefone_envio, wa_message_id, status, enviado_por, provider)
           VALUES ($1, $2, $3, $4, $5, $6, 'enviado', $7, 'uazapi')
           ON CONFLICT (chave_agenda) DO UPDATE SET
             telefone_envio = EXCLUDED.telefone_envio,
             wa_message_id = EXCLUDED.wa_message_id,
             status = 'enviado',
             enviado_por = EXCLUDED.enviado_por,
             enviado_at = NOW(),
             respondido_at = NULL,
             provider = 'uazapi'`,
          [chave, agenda.cod_paciente, medico_id, data, telefoneWhatsapp, waMessageId, atendenteId]
        );

        // Registrar mensagem no painel de conversas (canal recepcao / uazapi)
        try {
          const waChatId = telefoneWhatsapp + '@s.whatsapp.net';
          const conversaRes = await pool.query(
            `SELECT atd.upsert_conversa($1, $2, $3, $4, $5, NULL, $6, NULL) AS id`,
            [waChatId, 'individual', CONFIRMACAO_CATEGORIA, 'uazapi', pacienteNome, telefoneWhatsapp],
          );
          const conversaId = conversaRes.rows[0].id;

          const meta = JSON.stringify({
            source: 'confirmacao_agendamento',
            chave_agenda: chave,
            provider: 'uazapi',
          });
          const msgRes = await pool.query(
            `SELECT atd.registrar_mensagem($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS id`,
            [conversaId, waMessageId, true, null, null, 'text', textoLocal, null, null, null, meta, null],
          );
          const msgId = msgRes.rows[0].id;

          if (msgId && msgId > 0) {
            await pool.query(
              `UPDATE atd.conversas SET ultima_msg_from_me = TRUE WHERE id = $1`,
              [conversaId],
            );

            const [msgData, convData] = await Promise.all([
              pool.query(`SELECT * FROM atd.mensagens WHERE id = $1`, [msgId]),
              pool.query(`SELECT * FROM atd.conversas WHERE id = $1`, [conversaId]),
            ]);

            if (msgData.rows[0]) {
              sseManager.broadcast({
                type: 'nova_mensagem',
                data: { conversa_id: conversaId, mensagem: msgData.rows[0] },
              });
            }
            if (convData.rows[0]) {
              sseManager.broadcast({
                type: 'conversa_atualizada',
                data: {
                  conversa_id: conversaId,
                  ultima_msg: textoLocal.substring(0, 200),
                  nao_lida: convData.rows[0].nao_lida,
                  ultima_msg_from_me: true,
                },
              });
            }
          }
        } catch (regErr) {
          console.error(`[disparo] Erro ao registrar no painel chave=${chave}:`, regErr);
        }

        detalhes.push({ chave, paciente: pacienteNome, telefone: telefoneWhatsapp, status: 'enviado' });
        enviados++;
      } catch (err) {
        console.error(`[disparo] Erro envio chave=${chave}:`, err);
        detalhes.push({ chave, paciente: pacienteNome, telefone: telefoneWhatsapp, status: 'falha', erro: 'Erro de rede' });
        falhas++;
      }

      // Delay entre envios (exceto ultimo)
      if (i < chaves.length - 1) {
        await sleep(3000);
      }
    }

    return NextResponse.json({ enviados, falhas, sem_telefone, detalhes });
  } catch (err) {
    console.error('[api/agenda/disparo] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
