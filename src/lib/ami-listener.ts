import pool from './db';
import { sseManager } from './sse-manager';

// Estado das chamadas ativas (por uniqueid do Asterisk)
interface ActiveCall {
  dbId: number | null;
  uniqueid: string;
  channel: string;
  callerNumber: string;
  calledNumber: string;
  context: string;
  ramal: string | null;
  origem: 'whatsapp' | 'telefone';
  direcao: 'recebida' | 'realizada';
  startTime: Date;
}

const activeCalls = new Map<string, ActiveCall>();

let amiConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let amiInstance: any = null;

// Determina origem baseado no contexto do Asterisk
function getOrigem(context: string, accountcode?: string): 'whatsapp' | 'telefone' {
  if (context === 'from-whatsapp' || accountcode === 'whatsapp') {
    return 'whatsapp';
  }
  return 'telefone';
}

// Determina direcao baseado no contexto
function getDirecao(context: string): 'recebida' | 'realizada' {
  if (context.startsWith('from-')) return 'recebida';
  return 'realizada';
}

// Extrai numero do canal (ex: SIP/200-00000001 -> 200, PJSIP/trunk-00000001 -> trunk)
function extractNumber(channel: string): string {
  const match = channel.match(/\/([\w-]+)-/);
  return match ? match[1] : channel;
}

// Extrai ramal de um canal (ex: SIP/201-xxx -> 201)
function extractRamal(channel: string): string | null {
  const match = channel.match(/\/(2\d{2})-/);
  return match ? match[1] : null;
}

// Persiste nova chamada no banco
async function insertChamada(call: ActiveCall): Promise<number> {
  try {
    const result = await pool.query(
      `INSERT INTO atd.chamadas (origem, direcao, caller_number, called_number, status, asterisk_id, inicio_at)
       VALUES ($1, $2, $3, $4, 'ringing', $5, $6)
       RETURNING id`,
      [call.origem, call.direcao, call.callerNumber, call.calledNumber, call.uniqueid, call.startTime],
    );
    return result.rows[0].id;
  } catch (err) {
    console.error('[AMI] Erro ao inserir chamada:', err);
    return 0;
  }
}

// Atualiza chamada no banco
async function updateChamada(
  dbId: number,
  updates: Record<string, unknown>,
): Promise<void> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(updates)) {
    setClauses.push(`${key} = $${idx++}`);
    values.push(val);
  }

  if (setClauses.length === 0) return;

  values.push(dbId);
  try {
    await pool.query(
      `UPDATE atd.chamadas SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      values,
    );
  } catch (err) {
    console.error('[AMI] Erro ao atualizar chamada:', err);
  }
}

// Handler: Newchannel — nova chamada iniciou
function handleNewchannel(evt: Record<string, string>) {
  const uniqueid = evt.uniqueid;
  const channel = evt.channel || '';
  const context = evt.context || '';
  const callerNumber = evt.calleridnum || '';
  const calledNumber = evt.exten || '';

  // Ignorar canais internos e sub-canais
  if (!uniqueid || channel.includes('Local/') || activeCalls.has(uniqueid)) return;

  const origem = getOrigem(context, evt.accountcode);
  const direcao = getDirecao(context);

  const call: ActiveCall = {
    dbId: null,
    uniqueid,
    channel,
    callerNumber: extractNumber(channel).length <= 4 ? callerNumber : extractNumber(channel),
    calledNumber,
    context,
    ramal: null,
    origem,
    direcao,
    startTime: new Date(),
  };

  activeCalls.set(uniqueid, call);

  // Persistir e emitir SSE
  insertChamada(call).then((dbId) => {
    call.dbId = dbId;
    if (dbId > 0) {
      sseManager.broadcast({
        type: 'chamada_nova',
        data: {
          chamada: {
            id: dbId,
            conversa_id: null,
            wa_chatid: null,
            origem: call.origem,
            direcao: call.direcao,
            caller_number: call.callerNumber,
            called_number: call.calledNumber,
            ramal_atendeu: null,
            atendente_id: null,
            status: 'ringing',
            duracao_seg: 0,
            inicio_at: call.startTime.toISOString(),
            atendida_at: null,
            fim_at: null,
            gravacao_url: null,
            asterisk_id: uniqueid,
            metadata: {},
            created_at: call.startTime.toISOString(),
          },
        },
      });
    }
  });
}

// Handler: DialBegin — ramal comecou a tocar
function handleDialBegin(evt: Record<string, string>) {
  const uniqueid = evt.uniqueid;
  const destChannel = evt.destchannel || '';
  const call = activeCalls.get(uniqueid);
  if (!call) return;

  const ramal = extractRamal(destChannel);
  if (ramal) {
    call.ramal = ramal;
    if (call.dbId) {
      updateChamada(call.dbId, { ramal_atendeu: ramal });
    }

    sseManager.broadcast({
      type: 'ramal_status',
      data: { ramal, status: 'busy' },
    });
  }
}

// Handler: BridgeEnter — chamada atendida
function handleBridgeEnter(evt: Record<string, string>) {
  const uniqueid = evt.uniqueid;
  const call = activeCalls.get(uniqueid);
  if (!call) return;

  const ramal = extractRamal(evt.channel || '') || call.ramal;
  const now = new Date();

  if (call.dbId) {
    updateChamada(call.dbId, {
      status: 'answered',
      ramal_atendeu: ramal,
      atendida_at: now,
    });

    sseManager.broadcast({
      type: 'chamada_atualizada',
      data: { chamada_id: call.dbId, status: 'answered' },
    });
  }
}

// Handler: Hangup — chamada encerrada
function handleHangup(evt: Record<string, string>) {
  const uniqueid = evt.uniqueid;
  const call = activeCalls.get(uniqueid);
  if (!call) return;

  const now = new Date();
  const duracao = Math.round((now.getTime() - call.startTime.getTime()) / 1000);
  const cause = evt.cause || '';

  // Determinar status final
  let status: string;
  if (cause === '16' || cause === '17') {
    // 16 = normal clearing (atendida e desligada), 17 = busy
    status = cause === '17' ? 'busy' : (duracao > 2 ? 'answered' : 'missed');
  } else if (cause === '19' || cause === '21') {
    // 19 = no answer, 21 = rejected
    status = cause === '21' ? 'rejected' : 'missed';
  } else {
    status = duracao > 2 ? 'answered' : 'missed';
  }

  if (call.dbId) {
    updateChamada(call.dbId, {
      status,
      duracao_seg: duracao,
      fim_at: now,
    });

    sseManager.broadcast({
      type: 'chamada_atualizada',
      data: { chamada_id: call.dbId, status, duracao },
    });
  }

  // Liberar ramal
  if (call.ramal) {
    sseManager.broadcast({
      type: 'ramal_status',
      data: { ramal: call.ramal, status: 'online' },
    });
  }

  activeCalls.delete(uniqueid);
}

// Handler: VoicemailStart — voicemail
function handleVoicemail(evt: Record<string, string>) {
  const uniqueid = evt.uniqueid;
  const call = activeCalls.get(uniqueid);
  if (!call || !call.dbId) return;

  updateChamada(call.dbId, { status: 'voicemail' });

  sseManager.broadcast({
    type: 'chamada_atualizada',
    data: { chamada_id: call.dbId, status: 'voicemail' },
  });
}

// Iniciar conexao AMI
export function startAMIListener(): void {
  const host = process.env.AMI_HOST;
  const port = parseInt(process.env.AMI_PORT || '5038');
  const user = process.env.AMI_USER;
  const password = process.env.AMI_PASSWORD;

  if (!host || !user || !password) {
    console.warn('[AMI] Variaveis AMI_HOST/AMI_USER/AMI_PASSWORD nao configuradas. AMI desabilitado.');
    return;
  }

  connectAMI(host, port, user, password);
}

function connectAMI(host: string, port: number, user: string, password: string): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  console.log(`[AMI] Conectando a ${host}:${port}...`);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsteriskManager = require('asterisk-manager');
    const ami = new AsteriskManager(port, host, user, password, true);
    amiInstance = ami;

    ami.keepConnected();

    ami.on('connect', () => {
      console.log('[AMI] Conectado ao Asterisk');
      amiConnected = true;
    });

    ami.on('newchannel', handleNewchannel);
    ami.on('dialbegin', handleDialBegin);
    ami.on('bridgeenter', handleBridgeEnter);
    ami.on('hangup', handleHangup);
    ami.on('voicemailstart', handleVoicemail);

    ami.on('error', (err: Error) => {
      console.error('[AMI] Erro:', err.message);
      amiConnected = false;
      scheduleReconnect(host, port, user, password);
    });

    ami.on('close', () => {
      console.warn('[AMI] Conexao fechada');
      amiConnected = false;
      scheduleReconnect(host, port, user, password);
    });
  } catch (err) {
    console.error('[AMI] Falha ao conectar:', err);
    amiConnected = false;
    scheduleReconnect(host, port, user, password);
  }
}

function scheduleReconnect(host: string, port: number, user: string, password: string): void {
  if (reconnectTimer) return;
  console.log('[AMI] Reconectando em 10 segundos...');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectAMI(host, port, user, password);
  }, 10000);
}

export function isAMIConnected(): boolean {
  return amiConnected;
}

export function getActiveCallsCount(): number {
  return activeCalls.size;
}

/**
 * Envia QueuePause ao Asterisk para pausar/despausar um ramal em todas as filas.
 * Fallback gracioso se AMI nao estiver conectado.
 */
export function pauseQueue(ramal: string, paused: boolean, reason?: string): void {
  if (!amiConnected || !amiInstance) {
    console.warn(`[AMI] QueuePause ignorado (AMI offline) — ramal=${ramal} paused=${paused}`);
    return;
  }

  try {
    const action: Record<string, string> = {
      action: 'QueuePause',
      interface: `SIP/${ramal}`,
      paused: paused ? 'true' : 'false',
    };
    if (reason) {
      action.reason = reason;
    }

    amiInstance.action(action, (err: Error | null) => {
      if (err) {
        console.error(`[AMI] Erro ao executar QueuePause ramal=${ramal}:`, err.message);
      } else {
        console.log(`[AMI] QueuePause ramal=${ramal} paused=${paused} reason=${reason || 'none'}`);
      }
    });
  } catch (err) {
    console.error(`[AMI] Excecao ao enviar QueuePause ramal=${ramal}:`, err);
  }
}
