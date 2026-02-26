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
const CAMPO_COLUNA: Record<string, { tabela: 'exams' | 'patients'; coluna: string }> = {
  DataExame: { tabela: 'exams', coluna: 'exam_date' },
  Nome: { tabela: 'patients', coluna: 'name' },
  DataNasc: { tabela: 'patients', coluna: 'birth_date' },
  Sexo: { tabela: 'patients', coluna: 'sex' },
  Endereco: { tabela: 'exams', coluna: 'location_code' },
  Cidade: { tabela: 'exams', coluna: 'device_model' },
  Pais: { tabela: 'patients', coluna: 'responsible' },
  Celular: { tabela: 'patients', coluna: 'phone' },
  Profissao: { tabela: 'exams', coluna: 'technician' },
  Email: { tabela: 'patients', coluna: 'email' },
  Indicacao: { tabela: 'exams', coluna: 'indication' },
  Cid: { tabela: 'exams', coluna: 'cid' },
  Medico: { tabela: 'exams', coluna: 'requesting_doctor' },
  ExamesAnt: { tabela: 'exams', coluna: 'previous_exams' },
};

const SUPERVISAO_TELEFONE = '5561996628353';
const INTERVALO_MS = 120_000; // 2 minutos

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
  email: string | null;
  indication: string | null;
  cid: string | null;
  requesting_doctor: string | null;
  previous_exams: string | null;
  created_at: string;
}

class FichaValidator {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private watermark: Date | null = null;
  private running = false;
  private stats = {
    ciclos: 0,
    alertasEnviados: 0,
    correcoesDetectadas: 0,
    ultimoCiclo: null as string | null,
    erros: 0,
  };

  async start(): Promise<void> {
    if (this.running) {
      console.log('[FichaValidator] Ja em execucao');
      return;
    }

    try {
      // Capturar watermark = MAX(created_at) do banco externo
      const result = await examesPool.query(
        `SELECT MAX(created_at) as max_created FROM exams`,
      );
      this.watermark = result.rows[0]?.max_created
        ? new Date(result.rows[0].max_created)
        : new Date();

      console.log(`[FichaValidator] Watermark definido: ${this.watermark.toISOString()}`);

      this.running = true;
      this.intervalId = setInterval(() => {
        this.checkFichas().catch((err) => {
          console.error('[FichaValidator] Erro no ciclo:', err);
          this.stats.erros++;
        });
      }, INTERVALO_MS);

      console.log('[FichaValidator] Iniciado — verificacao a cada 2 minutos');
    } catch (err) {
      console.error('[FichaValidator] Erro ao iniciar:', err);
    }
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
      watermark: this.watermark?.toISOString() || null,
      stats: { ...this.stats },
    };
  }

  private async checkFichas(): Promise<void> {
    this.stats.ciclos++;
    this.stats.ultimoCiclo = new Date().toISOString();

    // ETAPA 1: Fichas novas com campos faltantes
    await this.processNewExams();

    // ETAPA 2: Fichas corrigidas
    await this.checkCorrections();
  }

  private async processNewExams(): Promise<void> {
    if (!this.watermark) return;

    try {
      // Buscar exames novos no banco externo
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
          p.email,
          e.indication,
          e.cid,
          e.requesting_doctor,
          e.previous_exams,
          e.created_at
        FROM exams e
        JOIN patients p ON p.id = e.patient_id
        WHERE e.created_at > $1
        ORDER BY e.created_at ASC`,
        [this.watermark],
      );

      if (examsResult.rows.length === 0) return;

      // Atualizar watermark para o mais recente
      const lastCreatedAt = examsResult.rows[examsResult.rows.length - 1].created_at;
      this.watermark = new Date(lastCreatedAt);

      // Filtrar exames que ja tem alerta registrado
      const examIds = examsResult.rows.map((r) => r.exam_id);
      const alertasResult = await pool.query(
        `SELECT exam_id FROM atd.eeg_alertas_ficha WHERE exam_id = ANY($1::uuid[])`,
        [examIds],
      );
      const alertasExistentes = new Set(alertasResult.rows.map((r: { exam_id: string }) => r.exam_id));

      for (const row of examsResult.rows) {
        if (alertasExistentes.has(row.exam_id)) continue;

        const missing = this.validateFields(row);
        if (missing.length > 0) {
          await this.sendAlerts(row, missing);
        }
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
      Profissao: row.technician,
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
      // Busca exata por LOWER
      const result = await pool.query(
        `SELECT id, nome, telefone, setor FROM atd.hub_usuarios
         WHERE ativo = TRUE AND LOWER(nome) = LOWER($1)
         LIMIT 1`,
        [name.trim()],
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Busca fuzzy: LIKE
      const fuzzyResult = await pool.query(
        `SELECT id, nome, telefone, setor FROM atd.hub_usuarios
         WHERE ativo = TRUE AND LOWER(nome) LIKE LOWER($1)
         LIMIT 1`,
        [`%${name.trim()}%`],
      );

      return fuzzyResult.rows[0] || null;
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
    const tecnico = await this.findTechnician(row.technician || '');
    const tecnicoTipo = this.classifyTechnician(tecnico?.setor || null);
    const tecnicoNome = tecnico?.nome || row.technician || 'Nao identificado';
    const tecnicoTelefone = tecnico?.telefone || null;

    const nomePaciente = row.name || 'Nao informado';
    const dataExame = row.exam_date
      ? new Date(row.exam_date).toLocaleDateString('pt-BR')
      : 'Nao informada';

    const listaCampos = missing
      .map((campo) => `\u274C ${CAMPOS_OBRIGATORIOS[campo] || campo}`)
      .join('\n');

    // Montar mensagens conforme templates
    let alertaTecnico: string;
    let notificacaoSupervisao: string;

    if (tecnicoTipo === 'plantonista') {
      alertaTecnico = `\u26A0\uFE0F *ALERTA \u2014 Ficha Incompleta*

T\u00E9cnico(a): ${tecnicoNome}
Paciente: ${nomePaciente}
Data: ${dataExame}

A ficha do paciente acima apresenta campos obrigat\u00F3rios n\u00E3o preenchidos:

${listaCampos}

Conforme as regras estabelecidas pela empresa, o preenchimento completo da ficha \u00E9 *obrigat\u00F3rio* para a realiza\u00E7\u00E3o e o faturamento do exame.

Fichas com campos obrigat\u00F3rios pendentes *n\u00E3o ser\u00E3o faturadas* e os valores correspondentes *n\u00E3o ser\u00E3o repassados*.

Regularize a ficha assim que poss\u00EDvel.

Cl\u00EDnica Schappo \u2014 Sistema de Gest\u00E3o EEG`;

      notificacaoSupervisao = `\uD83D\uDCCB *Ficha Incompleta \u2014 Plantonista*

T\u00E9cnico(a): ${tecnicoNome}
Telefone: ${tecnicoTelefone || 'N\u00E3o cadastrado'}
Paciente: ${nomePaciente}
Data: ${dataExame}

A ficha do paciente acima foi criada com campos obrigat\u00F3rios pendentes:

${listaCampos}

O t\u00E9cnico j\u00E1 foi alertado.

Caso n\u00E3o haja corre\u00E7\u00E3o ou justificativa plaus\u00EDvel, as provid\u00EAncias cab\u00EDveis ficam a cargo da supervis\u00E3o.

Conforme regras da empresa, fichas incompletas de plantonistas *n\u00E3o s\u00E3o faturadas*.

Cl\u00EDnica Schappo \u2014 Sistema de Gest\u00E3o EEG`;
    } else {
      alertaTecnico = `\u26A0\uFE0F *ALERTA \u2014 Ficha Incompleta*

T\u00E9cnico(a): ${tecnicoNome}
Paciente: ${nomePaciente}
Data: ${dataExame}

A ficha do paciente acima apresenta campos obrigat\u00F3rios n\u00E3o preenchidos:

${listaCampos}

O preenchimento completo e correto da ficha \u00E9 *obrigat\u00F3rio* conforme as normas da empresa.

Fichas com campos pendentes ser\u00E3o encaminhadas \u00E0 *supervis\u00E3o* para verifica\u00E7\u00E3o e provid\u00EAncias cab\u00EDveis.

Regularize a ficha assim que poss\u00EDvel.

Cl\u00EDnica Schappo \u2014 Sistema de Gest\u00E3o EEG`;

      notificacaoSupervisao = `\uD83D\uDCCB *Ficha Incompleta \u2014 Rotineiro*

T\u00E9cnico(a): ${tecnicoNome}
Telefone: ${tecnicoTelefone || 'N\u00E3o cadastrado'}
Paciente: ${nomePaciente}
Data: ${dataExame}

A ficha do paciente acima foi criada com campos obrigat\u00F3rios pendentes:

${listaCampos}

O t\u00E9cnico j\u00E1 foi alertado.

Caso n\u00E3o haja corre\u00E7\u00E3o ou justificativa plaus\u00EDvel, as provid\u00EAncias cab\u00EDveis ficam a cargo da supervis\u00E3o.

Cl\u00EDnica Schappo \u2014 Sistema de Gest\u00E3o EEG`;
    }

    // Enviar alertas simultaneamente
    const promises: Promise<void>[] = [];

    // Alerta ao tecnico (se tem telefone)
    if (tecnicoTelefone) {
      promises.push(
        this.sendWhatsApp(tecnicoTelefone, alertaTecnico)
          .then(() => console.log(`[FichaValidator] Alerta enviado ao tecnico ${tecnicoNome} (${tecnicoTelefone})`))
          .catch((err) => console.error(`[FichaValidator] Erro ao enviar alerta ao tecnico:`, err)),
      );
    } else {
      console.warn(`[FichaValidator] Tecnico "${tecnicoNome}" sem telefone cadastrado — alerta nao enviado`);
    }

    // Notificacao a supervisao (Dany)
    promises.push(
      this.sendWhatsApp(SUPERVISAO_TELEFONE, notificacaoSupervisao)
        .then(() => console.log(`[FichaValidator] Supervisao notificada sobre ficha de ${nomePaciente}`))
        .catch((err) => console.error(`[FichaValidator] Erro ao notificar supervisao:`, err)),
    );

    await Promise.allSettled(promises);

    // Registrar no banco
    const totalOk = 14 - missing.length;
    try {
      await pool.query(
        `INSERT INTO atd.eeg_alertas_ficha
          (exam_id, patient_id, tecnico_nome, tecnico_id, tecnico_telefone, tecnico_tipo,
           campos_faltantes, total_campos_ok, total_campos, paciente_nome, data_exame)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 14, $9, $10)
         ON CONFLICT (exam_id) DO NOTHING`,
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
      this.stats.alertasEnviados++;
    } catch (err) {
      console.error('[FichaValidator] Erro ao registrar alerta:', err);
      this.stats.erros++;
    }
  }

  private async checkCorrections(): Promise<void> {
    try {
      // Buscar fichas com alerta pendente de correcao
      const alertas = await pool.query(
        `SELECT id, exam_id, patient_id, tecnico_nome, tecnico_tipo
         FROM atd.eeg_alertas_ficha
         WHERE corrigido = FALSE`,
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
