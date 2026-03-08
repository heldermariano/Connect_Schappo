import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { queryLatin1 } from '@/lib/db-agenda';
import pool from '@/lib/db';
import { getUazapiToken, normalizePhone, extractUazapiMessageIds } from '@/lib/types';
import { sseManager } from '@/lib/sse-manager';

// Delay entre envios (rate limit UAZAPI)
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Novo endereco da clinica — enviar localizacao apos confirmacao
const CLINICA_LOCATION = {
  latitude: -15.826413,
  longitude: -47.9305946,
  name: 'Clínica Schappo',
  address: 'SHLS 716 SUL BLOCO F SALA 208, CENTRO CLÍNICO OSWALDO CRUZ, ASA SUL',
  observacao: 'Segue o novo endereço de atendimento:',
};

// Andrea Schappo: enviar localizacao apenas nas segundas-feiras
// Todos os outros medicos: enviar localizacao sempre
function shouldSendLocation(nomeMedico: string, dataAgenda: string): boolean {
  const nomeUpper = nomeMedico.toUpperCase();
  const isAndrea = nomeUpper.includes('ANDREA') && nomeUpper.includes('SCHAPPO');
  if (isAndrea) {
    // Segunda-feira = day 1 (getDay())
    const date = new Date(dataAgenda + 'T12:00:00');
    return date.getDay() === 1;
  }
  return true;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const { chaves, mensagem, medico_id, data } = await request.json();

    if (!chaves || !Array.isArray(chaves) || chaves.length === 0) {
      return NextResponse.json({ error: 'chaves eh obrigatorio (array)' }, { status: 400 });
    }
    if (!mensagem || typeof mensagem !== 'string' || !mensagem.trim()) {
      return NextResponse.json({ error: 'mensagem eh obrigatoria' }, { status: 400 });
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

    // Enviar via UAZAPI (Recepcao) — sem limitacao de janela de 24h
    const uazapiUrl = process.env.UAZAPI_URL;
    const uazapiToken = getUazapiToken('recepcao');
    const atendenteId = parseInt(session.user.id as string);

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

      // Substituir variaveis no template
      const nomeMedico = (agenda.nom_guerra as string) || (agenda.nom_medico as string) || '';
      const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR');
      const hora = (agenda.des_hora as string) || '';
      const procedimento = (agenda.des_procedimento as string) || '';

      const textoFinal = mensagem
        .replace(/\{nome_paciente\}/g, pacienteNome.split(' ')[0])
        .replace(/\{nome_paciente_completo\}/g, pacienteNome)
        .replace(/\{data\}/g, dataFormatada)
        .replace(/\{hora\}/g, hora)
        .replace(/\{nome_medico\}/g, nomeMedico)
        .replace(/\{procedimento\}/g, procedimento);

      // Enviar via UAZAPI (Recepcao)
      try {
        const res = await fetch(`${uazapiUrl}/send/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            token: uazapiToken,
          },
          body: JSON.stringify({ number: telefoneWhatsapp, text: textoFinal }),
        });

        if (!res.ok) {
          const body = await res.text();
          console.error(`[disparo] Falha UAZAPI chave=${chave}:`, res.status, body);
          detalhes.push({ chave, paciente: pacienteNome, telefone: telefoneWhatsapp, status: 'falha', erro: `UAZAPI ${res.status}` });
          falhas++;
          continue;
        }

        const responseData = await res.json();
        const ids = extractUazapiMessageIds(responseData);
        console.log(`[disparo] UAZAPI OK chave=${chave} to=${telefoneWhatsapp} msgId=${ids.shortId}`);

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
          [chave, agenda.cod_paciente, medico_id, data, telefoneWhatsapp, ids.shortId, atendenteId]
        );

        // Registrar mensagem no painel de conversas (atd.conversas + atd.mensagens)
        try {
          const waChatId = telefoneWhatsapp + '@s.whatsapp.net';
          const conversaRes = await pool.query(
            `SELECT atd.upsert_conversa($1, $2, $3, $4, $5, NULL, $6, NULL) AS id`,
            [waChatId, 'individual', 'recepcao', 'uazapi', pacienteNome, telefoneWhatsapp],
          );
          const conversaId = conversaRes.rows[0].id;

          const meta = JSON.stringify({ source: 'confirmacao_agendamento', chave_agenda: chave });
          const msgRes = await pool.query(
            `SELECT atd.registrar_mensagem($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS id`,
            [conversaId, ids.shortId, true, null, null, 'text', textoFinal, null, null, null, meta, null],
          );
          const msgId = msgRes.rows[0].id;

          if (msgId && msgId > 0) {
            // Marcar ultima_msg_from_me
            await pool.query(
              `UPDATE atd.conversas SET ultima_msg_from_me = TRUE WHERE id = $1`,
              [conversaId],
            );

            // Buscar mensagem e conversa atualizadas para SSE
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
                  ultima_msg: textoFinal,
                  nao_lida: convData.rows[0].nao_lida,
                  ultima_msg_from_me: true,
                },
              });
            }
          }
        } catch (regErr) {
          console.error(`[disparo] Erro ao registrar no painel chave=${chave}:`, regErr);
          // Nao falhar o disparo se o registro no painel falhar
        }

        // Enviar localizacao do novo endereco apos confirmacao
        // Andrea Schappo: apenas segundas-feiras | Outros: sempre
        const nomeMedicoFull = (agenda.nom_medico as string) || (agenda.nom_guerra as string) || '';
        if (shouldSendLocation(nomeMedicoFull, data)) {
          try {
            // Enviar observacao antes da localizacao
            await sleep(1500);
            await fetch(`${uazapiUrl}/send/text`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', token: uazapiToken },
              body: JSON.stringify({ number: telefoneWhatsapp, text: CLINICA_LOCATION.observacao }),
            });

            await sleep(1500);
            const locRes = await fetch(`${uazapiUrl}/send/location`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', token: uazapiToken },
              body: JSON.stringify({
                number: telefoneWhatsapp,
                latitude: CLINICA_LOCATION.latitude,
                longitude: CLINICA_LOCATION.longitude,
                name: CLINICA_LOCATION.name,
                address: CLINICA_LOCATION.address,
              }),
            });
            if (locRes.ok) {
              console.log(`[disparo] Localizacao enviada chave=${chave} to=${telefoneWhatsapp}`);

              // Registrar localizacao no painel de conversas
              try {
                const locData = await locRes.json();
                const locIds = extractUazapiMessageIds(locData);
                const waChatId = telefoneWhatsapp + '@s.whatsapp.net';
                const conversaLocRes = await pool.query(
                  `SELECT atd.upsert_conversa($1, $2, $3, $4, $5, NULL, $6, NULL) AS id`,
                  [waChatId, 'individual', 'recepcao', 'uazapi', pacienteNome, telefoneWhatsapp],
                );
                const conversaLocId = conversaLocRes.rows[0].id;
                const locConteudo = `📍 ${CLINICA_LOCATION.name}\n${CLINICA_LOCATION.address}`;
                const locMeta = JSON.stringify({
                  latitude: CLINICA_LOCATION.latitude,
                  longitude: CLINICA_LOCATION.longitude,
                  name: CLINICA_LOCATION.name,
                  address: CLINICA_LOCATION.address,
                  source: 'confirmacao_agendamento_localizacao',
                  message_id_full: locIds.fullId || locIds.shortId,
                });
                const locMsgRes = await pool.query(
                  `SELECT atd.registrar_mensagem($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS id`,
                  [conversaLocId, locIds.shortId, true, null, null, 'location', locConteudo, null, null, null, locMeta, null],
                );
                const locMsgId = locMsgRes.rows[0].id;
                if (locMsgId && locMsgId > 0) {
                  await pool.query(
                    `UPDATE atd.conversas SET ultima_msg_from_me = TRUE WHERE id = $1`,
                    [conversaLocId],
                  );
                  const [locMsgData, locConvData] = await Promise.all([
                    pool.query(`SELECT * FROM atd.mensagens WHERE id = $1`, [locMsgId]),
                    pool.query(`SELECT * FROM atd.conversas WHERE id = $1`, [conversaLocId]),
                  ]);
                  if (locMsgData.rows[0]) {
                    sseManager.broadcast({
                      type: 'nova_mensagem',
                      data: { conversa_id: conversaLocId, mensagem: locMsgData.rows[0] },
                    });
                  }
                  if (locConvData.rows[0]) {
                    sseManager.broadcast({
                      type: 'conversa_atualizada',
                      data: {
                        conversa_id: conversaLocId,
                        ultima_msg: locConteudo.substring(0, 200),
                        nao_lida: locConvData.rows[0].nao_lida,
                        ultima_msg_from_me: true,
                      },
                    });
                  }
                }
              } catch (locRegErr) {
                console.error(`[disparo] Erro ao registrar localizacao no painel chave=${chave}:`, locRegErr);
              }
            } else {
              console.error(`[disparo] Falha ao enviar localizacao chave=${chave}:`, locRes.status);
            }
          } catch (locErr) {
            console.error(`[disparo] Erro envio localizacao chave=${chave}:`, locErr);
          }
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
