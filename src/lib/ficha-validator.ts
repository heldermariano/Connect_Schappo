import examesPool from './db-exames';
import pool from './db';

// Mapeamento campo XML -> nome legivel (para mensagens de alerta)
const CAMPOS_OBRIGATORIOS: Record<string, string> = {
  DataExame: 'Data do exame',
  Nome: 'Nome do paciente',
  DataNasc: 'Data de nascimento',
  Sexo: 'Sexo',
  Endereco: 'Local/enfermaria',
  Cidade: 'Aparelho utilizado',
  Pais: 'Responsavel',
  Celular: 'Celular do paciente/responsavel',
  Profissao: 'Tecnico responsavel',
  Email: 'Email/aparelho',
  Indicacao: 'Indicacao clinica',
  Cid: 'CID',
  Medico: 'Medico solicitante',
  ExamesAnt: 'Exames anteriores',
};

// Mapeamento campo XML -> coluna real no banco externo
// CORRIGIDO: companion_name = tecnico responsavel (nao exams.technician que raramente e preenchido)
const CAMPO_COLUNA: Record<string, { tabela: 'exams' | 'patients'; coluna: string }> = {
  DataExame: { tabela: 'exams', coluna: 'exam_date' },
  Nome: { tabela: 'patients', coluna: 'name' },
  DataNasc: { tabela: 'patients', coluna: 'birth_date' },
  Sexo: { tabela: 'patients', coluna: 'sex' },
  Endereco: { tabela: 'exams', coluna: 'location_code' },
  Cidade: { tabela: 'exams', coluna: 'device_model' },
  Pais: { tabela: 'patients', coluna: 'responsible' },
  Celular: { tabela: 'patients', coluna: 'phone' },
  Profissao: { tabela: 'patients', coluna: 'companion_name' },
  Email: { tabela: 'patients', coluna: 'email' },
  Indicacao: { tabela: 'exams', coluna: 'indication' },
  Cid: { tabela: 'exams', coluna: 'cid' },
  Medico: { tabela: 'exams', coluna: 'requesting_doctor' },
  ExamesAnt: { tabela: 'exams', coluna: 'previous_exams' },
};

const SUPERVISAO_TELEFONE = '5561996628353';
const INTERVALO_MS = 120_000; // 2 minutos
// Prazo apos registro para enviar alerta de correcao (10 minutos)
const PRAZO_CORRECAO_MIN = 10;
// Delay entre mensagens WhatsApp para evitar rate limit da Meta/360Dialog
const WHATSAPP_DELAY_MS = 8000;

interface ExamRow {
  exam_id: string;
  patient_id: string;
  exam_date: string | null;
  name: string | null;
  birth_date: string | null;
  sex: string | null;
  location_code: string | null;
  device_model: string | null;
  responsible: string | null;
  phone: string | null;
  technician: string | null;
  companion_name: string | null;
  email: string | null;
  indication: string | null;
  cid: string | null;
  requesting_doctor: string | null;
  previous_exams: string | null;
  created_at: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FichaValidator {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private stats = {
    ciclos: 0,
    alertasEnviados: 0,
    alertasFalha: 0,
    correcoesDetectadas: 0,
    ultimoCiclo: null as string | null,
    erros: 0,
  };

  async start(): Promise<void> {
    if (this.running) {
      console.log('[FichaValidator] Ja em execucao');
      return;
    }

    this.running = true;
    this.intervalId = setInterval(() => {
      this.checkFichas().catch((err) => {
        console.error('[FichaValidator] Erro no ciclo:', err);
        this.stats.erros++;
      });
    }, INTERVALO_MS);

    console.log(`[FichaValidator] Iniciado — verificacao a cada 2 minutos (prazo: ${PRAZO_CORRECAO_MIN}min apos registro)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    console.log('[FichaValidator] Parado');
  }

  getStatus() {
    return {
      running: this.running,
      stats: { ...this.stats },
    };
  }

  private async checkFichas(): Promise<void> {
    this.stats.ciclos++;
    this.stats.ultimoCiclo = new Date().toISOString();

    // ETAPA 1: Fichas de hoje com campos faltantes (sem alerta ainda)
    await this.processNewExams();

    // ETAPA 2: Fichas corrigidas (alertas de hoje pendentes)
    await this.checkCorrections();
  }

  private async processNewExams(): Promise<void> {
    try {
      // Buscar TODOS os exames de HOJE no banco externo
      // Filtro por exam_date (nao created_at) — imune a migracoes de dados antigos
      // So alerta exames registrados ha mais de PRAZO_CORRECAO_MIN minutos (periodo de adaptacao)
      const examsResult = await examesPool.query<ExamRow>(
        `SELECT
          e.id AS exam_id,
          p.id AS patient_id,
          e.exam_date,
          p.name,
          p.birth_date,
          p.sex,
          e.location_code,
          e.device_model,
          p.responsible,
          p.phone,
          e.technician,
          p.companion_name,
          p.email,
          e.indication,
          e.cid,
          e.requesting_doctor,
          e.previous_exams,
          e.created_at
        FROM exams e
        JOIN patients p ON p.id = e.patient_id
        WHERE e.exam_date::date = CURRENT_DATE
          AND p.birth_date IS NOT NULL
          AND e.created_at <= NOW() - make_interval(mins => $1)
        ORDER BY e.created_at ASC`,
        [PRAZO_CORRECAO_MIN],
      );

      if (examsResult.rows.length === 0) return;

      // Filtrar exames que ja tem alerta registrado no banco local
      const examIds = examsResult.rows.map((r) => r.exam_id);
      const alertasResult = await pool.query(
        `SELECT exam_id FROM atd.eeg_alertas_ficha WHERE exam_id = ANY($1::uuid[])`,
        [examIds],
      );
      const alertasExistentes = new Set(alertasResult.rows.map((r: { exam_id: string }) => r.exam_id));

      // Processar apenas exames sem alerta
      let novos = 0;
      for (const row of examsResult.rows) {
        if (alertasExistentes.has(row.exam_id)) continue;

        const missing = this.validateFields(row);
        if (missing.length > 0) {
          await this.sendAlerts(row, missing);
          novos++;
          await delay(WHATSAPP_DELAY_MS);
        }
      }

      if (novos > 0) {
        console.log(`[FichaValidator] ${novos} alertas novos criados de ${examsResult.rows.length} exames de hoje`);
      }
    } catch (err) {
      console.error('[FichaValidator] Erro ao processar fichas novas:', err);
      this.stats.erros++;
    }
  }

  private validateFields(row: ExamRow): string[] {
    const missing: string[] = [];

    const fieldMap: Record<string, unknown> = {
      DataExame: row.exam_date,
      Nome: row.name,
      DataNasc: row.birth_date,
      Sexo: row.sex,
      Endereco: row.location_code,
      Cidade: row.device_model,
      Pais: row.responsible,
      Celular: row.phone,
      Profissao: row.companion_name,
      Email: row.email,
      Indicacao: row.indication,
      Cid: row.cid,
      Medico: row.requesting_doctor,
      ExamesAnt: row.previous_exams,
    };

    for (const [campo, valor] of Object.entries(fieldMap)) {
      if (valor === null || valor === undefined) {
        missing.push(campo);
        continue;
      }
      const str = String(valor).trim();
      if (str === '') {
        missing.push(campo);
        continue;
      }
      // Validacao especial: Nome min 5 chars
      if (campo === 'Nome' && str.length < 5) {
        missing.push(campo);
      }
    }

    return missing;
  }

  private async findTechnician(name: string): Promise<{
    id: number | null;
    nome: string;
    telefone: string | null;
    setor: string | null;
  } | null> {
    if (!name || !name.trim()) return null;

    try {
      // 1. Busca exata por LOWER
      const result = await pool.query(
        `SELECT id, nome, telefone, setor FROM atd.hub_usuarios
         WHERE ativo = TRUE AND LOWER(nome) = LOWER($1)
         LIMIT 1`,
        [name.trim()],
      );
      if (result.rows.length > 0) return result.rows[0];

      // 2. Busca fuzzy: nome da ficha contem nome do hub (ex: "PAULA RODRIGUES" contem "Paula")
      const fuzzyResult = await pool.query(
        `SELECT id, nome, telefone, setor FROM atd.hub_usuarios
         WHERE ativo = TRUE AND LOWER($1) LIKE '%' || LOWER(nome) || '%'
         ORDER BY LENGTH(nome) DESC
         LIMIT 1`,
        [name.trim()],
      );
      if (fuzzyResult.rows.length > 0) return fuzzyResult.rows[0];

      // 3. Busca inversa: nome do hub contem parte do nome da ficha
      const inverseResult = await pool.query(
        `SELECT id, nome, telefone, setor FROM atd.hub_usuarios
         WHERE ativo = TRUE AND LOWER(nome) LIKE '%' || LOWER($1) || '%'
         LIMIT 1`,
        [name.trim()],
      );
      if (inverseResult.rows.length > 0) return inverseResult.rows[0];

      // 4. Busca pelo primeiro nome
      const firstName = name.trim().split(/\s+/)[0];
      if (firstName.length >= 3) {
        const firstNameResult = await pool.query(
          `SELECT id, nome, telefone, setor FROM atd.hub_usuarios
           WHERE ativo = TRUE AND LOWER(nome) LIKE LOWER($1) || '%'
           LIMIT 1`,
          [firstName],
        );
        if (firstNameResult.rows.length > 0) return firstNameResult.rows[0];
      }

      return null;
    } catch (err) {
      console.error('[FichaValidator] Erro ao buscar tecnico:', err);
      return null;
    }
  }

  private classifyTechnician(setor: string | null): 'plantonista' | 'rotineiro' {
    if (setor && setor.toLowerCase().includes('plantonista')) {
      return 'plantonista';
    }
    return 'rotineiro';
  }

  private async sendAlerts(row: ExamRow, missing: string[]): Promise<void> {
    // Usar companion_name como campo principal do tecnico (campo real preenchido)
    // Fallback para exams.technician caso companion_name esteja vazio
    const tecnicoNaFicha = row.companion_name?.trim() || row.technician?.trim() || '';
    const tecnicoIdentificado = tecnicoNaFicha.length > 0;
    // Limpar nome para busca no hub_usuarios:
    // - Remover prefixo "TEC." ou "TEC "
    // - Remover sufixo de codigo de aparelho (ex: "C11", "C14", "C7")
    const tecnicoNomeLimpo = tecnicoNaFicha
      .replace(/^TEC\.?\s*/i, '')   // Remove prefixo TEC./TEC
      .replace(/\s+C\d+\s*$/i, '')  // Remove sufixo " C11", " C14", etc.
      .trim();
    const tecnico = tecnicoIdentificado ? await this.findTechnician(tecnicoNomeLimpo) : null;
    const tecnicoTipo = this.classifyTechnician(tecnico?.setor || null);
    const tecnicoNome = tecnico?.nome || tecnicoNaFicha || 'Nao identificado';
    const tecnicoTelefone = tecnico?.telefone || null;

    const nomePaciente = row.name || 'Nao informado';
    const dataExame = row.exam_date
      ? new Date(row.exam_date).toLocaleDateString('pt-BR')
      : 'Nao informada';

    const listaCampos = missing
      .map((campo) => `\u274C ${CAMPOS_OBRIGATORIOS[campo] || campo}`)
      .join('\n');

    // Montar mensagem de alerta ao tecnico (usada quando tecnico tem telefone)
    const tipoLabel = tecnicoTipo === 'plantonista' ? 'Plantonista' : 'Rotineiro';
    const regraFaturamento = tecnicoTipo === 'plantonista'
      ? `Conforme as regras estabelecidas pela empresa, o preenchimento completo da ficha \u00E9 *obrigat\u00F3rio* para a realiza\u00E7\u00E3o e o faturamento do exame.

Fichas com campos obrigat\u00F3rios pendentes *n\u00E3o ser\u00E3o faturadas* e os valores correspondentes *n\u00E3o ser\u00E3o repassados*.`
      : `O preenchimento completo e correto da ficha \u00E9 *obrigat\u00F3rio* conforme as normas da empresa.

Fichas com campos pendentes ser\u00E3o encaminhadas \u00E0 *supervis\u00E3o* para verifica\u00E7\u00E3o e provid\u00EAncias cab\u00EDveis.`;

    const alertaTecnico = `\u26A0\uFE0F *ALERTA \u2014 Ficha Incompleta*

T\u00E9cnico(a): ${tecnicoNome}
Paciente: ${nomePaciente}
Data: ${dataExame}

A ficha do paciente acima apresenta campos obrigat\u00F3rios n\u00E3o preenchidos:

${listaCampos}

${regraFaturamento}

Regularize a ficha assim que poss\u00EDvel.

Cl\u00EDnica Schappo \u2014 Sistema de Gest\u00E3o EEG`;

    // Montar mensagem para supervisao — varia conforme tecnico identificado ou nao
    let notificacaoSupervisao: string;

    if (!tecnicoIdentificado) {
      // Tecnico NAO colocou nome na ficha — supervisao precisa verificar o aparelho
      notificacaoSupervisao = `\uD83D\uDEA8 *Ficha Incompleta \u2014 T\u00E9cnico N\u00E3o Identificado*

Paciente: ${nomePaciente}
Data: ${dataExame}

A ficha do paciente acima foi criada *sem o campo "T\u00E9cnico respons\u00E1vel"* preenchido.

Campos obrigat\u00F3rios pendentes:

${listaCampos}

\u26A0\uFE0F *A\u00E7\u00E3o necess\u00E1ria:* Verifique qual t\u00E9cnico est\u00E1 com o aparelho que realizou este exame e solicite a corre\u00E7\u00E3o da ficha.

Cl\u00EDnica Schappo \u2014 Sistema de Gest\u00E3o EEG`;
    } else {
      // Tecnico identificado — mensagem padrao
      const tecAlertado = tecnicoTelefone
        ? 'O t\u00E9cnico j\u00E1 foi alertado.'
        : 'O t\u00E9cnico *n\u00E3o p\u00F4de ser alertado* (telefone n\u00E3o cadastrado no sistema).';

      const regraFaturamentoSup = tecnicoTipo === 'plantonista'
        ? '\nConforme regras da empresa, fichas incompletas de plantonistas *n\u00E3o s\u00E3o faturadas*.\n'
        : '';

      notificacaoSupervisao = `\uD83D\uDCCB *Ficha Incompleta \u2014 ${tipoLabel}*

T\u00E9cnico(a): ${tecnicoNome}
Telefone: ${tecnicoTelefone || 'N\u00E3o cadastrado'}
Paciente: ${nomePaciente}
Data: ${dataExame}

A ficha do paciente acima foi criada com campos obrigat\u00F3rios pendentes:

${listaCampos}

${tecAlertado}

Caso n\u00E3o haja corre\u00E7\u00E3o ou justificativa plaus\u00EDvel, as provid\u00EAncias cab\u00EDveis ficam a cargo da supervis\u00E3o.
${regraFaturamentoSup}
Cl\u00EDnica Schappo \u2014 Sistema de Gest\u00E3o EEG`;
    }

    // Registrar alerta no banco PRIMEIRO (antes de enviar WhatsApp)
    const totalOk = 14 - missing.length;
    let alertaRegistrado = false;
    try {
      const insertResult = await pool.query(
        `INSERT INTO atd.eeg_alertas_ficha
          (exam_id, patient_id, tecnico_nome, tecnico_id, tecnico_telefone, tecnico_tipo,
           campos_faltantes, total_campos_ok, total_campos, paciente_nome, data_exame)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 14, $9, $10)
         ON CONFLICT (exam_id) DO NOTHING
         RETURNING id`,
        [
          row.exam_id,
          row.patient_id,
          tecnicoNome,
          tecnico?.id || null,
          tecnicoTelefone,
          tecnicoTipo,
          missing.map((c) => CAMPOS_OBRIGATORIOS[c] || c),
          totalOk,
          row.name || null,
          row.exam_date || null,
        ],
      );
      alertaRegistrado = insertResult.rows.length > 0;
      if (alertaRegistrado) {
        this.stats.alertasEnviados++;
      }
    } catch (err) {
      console.error('[FichaValidator] Erro ao registrar alerta:', err);
      this.stats.erros++;
      return; // Nao enviar WhatsApp se nao conseguiu registrar
    }

    if (!alertaRegistrado) return; // ON CONFLICT — ja existia

    // Enviar alerta ao tecnico (apenas se identificado E tem telefone)
    if (tecnicoIdentificado && tecnicoTelefone) {
      try {
        await this.sendWhatsApp(tecnicoTelefone, alertaTecnico);
        console.log(`[FichaValidator] Alerta enviado ao tecnico ${tecnicoNome} (${tecnicoTelefone}) — paciente: ${nomePaciente}`);
      } catch (err) {
        console.error(`[FichaValidator] FALHA ao enviar alerta ao tecnico ${tecnicoNome} (${tecnicoTelefone}):`, err);
        this.stats.alertasFalha++;
      }
      // Delay entre mensagens para evitar rate limit
      await delay(WHATSAPP_DELAY_MS);
    } else if (tecnicoIdentificado && !tecnicoTelefone) {
      console.warn(`[FichaValidator] Tecnico "${tecnicoNome}" sem telefone cadastrado — alerta nao enviado, supervisao sera notificada`);
    } else {
      console.warn(`[FichaValidator] Tecnico nao identificado na ficha de ${nomePaciente} — supervisao sera notificada`);
    }

    // Notificacao a supervisao (SEMPRE — tanto com tecnico quanto sem)
    try {
      await this.sendWhatsApp(SUPERVISAO_TELEFONE, notificacaoSupervisao);
      console.log(`[FichaValidator] Supervisao notificada sobre ficha de ${nomePaciente} (tecnico: ${tecnicoIdentificado ? tecnicoNome : 'NAO IDENTIFICADO'})`);
    } catch (err) {
      console.error(`[FichaValidator] FALHA ao notificar supervisao sobre ${nomePaciente}:`, err);
      this.stats.alertasFalha++;
    }
  }

  private async checkCorrections(): Promise<void> {
    try {
      // Buscar fichas com alerta pendente de correcao — APENAS de HOJE
      const alertas = await pool.query(
        `SELECT id, exam_id, patient_id, tecnico_nome, tecnico_tipo
         FROM atd.eeg_alertas_ficha
         WHERE corrigido = FALSE
           AND data_exame::date = CURRENT_DATE`,
      );

      if (alertas.rows.length === 0) return;

      for (const alerta of alertas.rows) {
        // Re-verificar no banco externo
        const examResult = await examesPool.query<ExamRow>(
          `SELECT
            e.id AS exam_id,
            p.id AS patient_id,
            e.exam_date,
            p.name,
            p.birth_date,
            p.sex,
            e.location_code,
            e.device_model,
            p.responsible,
            p.phone,
            e.technician,
            p.companion_name,
            p.email,
            e.indication,
            e.cid,
            e.requesting_doctor,
            e.previous_exams,
            e.created_at
          FROM exams e
          JOIN patients p ON p.id = e.patient_id
          WHERE e.id = $1`,
          [alerta.exam_id],
        );

        if (examResult.rows.length === 0) continue;

        const row = examResult.rows[0];
        const missing = this.validateFields(row);

        if (missing.length === 0) {
          // Ficha corrigida!
          const nomePaciente = row.name || 'Nao informado';
          const dataExame = row.exam_date
            ? new Date(row.exam_date).toLocaleDateString('pt-BR')
            : 'Nao informada';
          const tecnicoNome = alerta.tecnico_nome || 'Nao identificado';
          const tipoLabel = alerta.tecnico_tipo === 'plantonista' ? 'Plantonista' : 'Rotineiro';

          const msgCorrecao = `\u2705 *Ficha Regularizada \u2014 ${tipoLabel}*

T\u00E9cnico(a): ${tecnicoNome}
Paciente: ${nomePaciente}
Data: ${dataExame}

A ficha foi *corrigida* pelo t\u00E9cnico.
Todos os campos obrigat\u00F3rios est\u00E3o preenchidos.

Nenhuma a\u00E7\u00E3o necess\u00E1ria.

Cl\u00EDnica Schappo \u2014 Sistema de Gest\u00E3o EEG`;

          try {
            await this.sendWhatsApp(SUPERVISAO_TELEFONE, msgCorrecao);
            console.log(`[FichaValidator] Correcao notificada: ${nomePaciente}`);
          } catch (err) {
            console.error('[FichaValidator] Erro ao notificar correcao:', err);
          }

          // Atualizar registro
          await pool.query(
            `UPDATE atd.eeg_alertas_ficha
             SET corrigido = TRUE, corrigido_at = NOW(), notificado_correcao = TRUE, updated_at = NOW()
             WHERE id = $1`,
            [alerta.id],
          );

          this.stats.correcoesDetectadas++;
        }
      }
    } catch (err) {
      console.error('[FichaValidator] Erro ao verificar correcoes:', err);
      this.stats.erros++;
    }
  }

  private async sendWhatsApp(to: string, text: string): Promise<void> {
    // Enviar pelo canal 360Dialog (numero Geral 556133455701 — canal oficial da clinica)
    const url = process.env.DIALOG360_API_URL;
    const apiKey = process.env.DIALOG360_API_KEY;

    if (!url || !apiKey) {
      throw new Error('360Dialog nao configurado');
    }

    const res = await fetch(`${url}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': apiKey,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text, preview_url: false },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`360Dialog retornou ${res.status}: ${body}`);
    }

    const data = await res.json();
    const msgId = data.messages?.[0]?.id || 'unknown';
    console.log(`[FichaValidator] WhatsApp enviado via 360Dialog para ${to}: msgId=${msgId}`);
  }
}

// Singleton global — sobrevive entre requests no mesmo processo
const globalForValidator = globalThis as unknown as { fichaValidator: FichaValidator };
export const fichaValidator = globalForValidator.fichaValidator || new FichaValidator();
if (process.env.NODE_ENV !== 'production') {
  globalForValidator.fichaValidator = fichaValidator;
}

export function startFichaValidator(): void {
  fichaValidator.start();
}

export function stopFichaValidator(): void {
  fichaValidator.stop();
}

export function getFichaValidatorStatus() {
  return fichaValidator.getStatus();
}
