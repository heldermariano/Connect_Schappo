import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { queryLatin1 } from '@/lib/db-agenda';
import pool from '@/lib/db';
import { normalizePhone } from '@/lib/types';

// Delay entre envios (rate limit API)
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

    // 360Dialog (numero Geral) — envia com botoes interativos
    const dialog360Url = process.env.DIALOG360_API_URL || 'https://waba-v2.360dialog.io';
    const dialog360Key = process.env.DIALOG360_API_KEY || '';
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

      // Enviar via 360Dialog com botoes interativos
      try {
        const payload360 = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: telefoneWhatsapp,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: textoFinal },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'CONFIRMAR', title: 'Confirmar' } },
                { type: 'reply', reply: { id: 'DESMARCAR', title: 'Desmarcar' } },
                { type: 'reply', reply: { id: 'REAGENDAR', title: 'Reagendar' } },
              ],
            },
          },
        };

        const res = await fetch(`${dialog360Url}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'D360-API-KEY': dialog360Key,
          },
          body: JSON.stringify(payload360),
        });

        if (!res.ok) {
          const body = await res.text();
          console.error(`[disparo] Falha 360Dialog chave=${chave}:`, res.status, body);
          detalhes.push({ chave, paciente: pacienteNome, telefone: telefoneWhatsapp, status: 'falha', erro: `360Dialog ${res.status}` });
          falhas++;
          continue;
        }

        const responseData = await res.json();
        const waMessageId = responseData.messages?.[0]?.id || '';

        // Registrar no banco local
        await pool.query(
          `INSERT INTO atd.confirmacao_agendamento
           (chave_agenda, cod_paciente, id_medico, dat_agenda, telefone_envio, wa_message_id, status, enviado_por, provider)
           VALUES ($1, $2, $3, $4, $5, $6, 'enviado', $7, '360dialog')
           ON CONFLICT (chave_agenda) DO UPDATE SET
             telefone_envio = EXCLUDED.telefone_envio,
             wa_message_id = EXCLUDED.wa_message_id,
             status = 'enviado',
             enviado_por = EXCLUDED.enviado_por,
             enviado_at = NOW(),
             respondido_at = NULL,
             provider = '360dialog'`,
          [chave, agenda.cod_paciente, medico_id, data, telefoneWhatsapp, waMessageId, atendenteId]
        );

        detalhes.push({ chave, paciente: pacienteNome, telefone: telefoneWhatsapp, status: 'enviado' });
        enviados++;
      } catch (err) {
        console.error(`[disparo] Erro envio chave=${chave}:`, err);
        detalhes.push({ chave, paciente: pacienteNome, telefone: telefoneWhatsapp, status: 'falha', erro: 'Erro de rede' });
        falhas++;
      }

      // Delay entre envios (exceto ultimo)
      if (i < chaves.length - 1) {
        await sleep(2000);
      }
    }

    return NextResponse.json({ enviados, falhas, sem_telefone, detalhes });
  } catch (err) {
    console.error('[api/agenda/disparo] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
