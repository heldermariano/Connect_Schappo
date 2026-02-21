// =============================================================
// N8N — Codigo para o no "Function" de deteccao de chamada
// Inserir no workflow WF-01 (bot EEG / Recepcao)
// Posicao: apos o no "Normalizar Payload", antes do IF
// =============================================================

// O payload UAZAPI envia EventType=call quando alguem tenta
// ligar via WhatsApp para os numeros EEG ou Recepcao.
// Este codigo detecta o evento e prepara a auto-resposta
// direcionando o paciente para o numero geral (3345-5701).

const payload = $input.first().json;

// Detectar se e evento de chamada
const isCallEvent = payload.EventType === 'call';

// Extrair dados relevantes
const owner = payload.owner || '';
const callerChatId = payload.chat?.wa_chatid || payload.message?.from || '';
const callerPhone = callerChatId.split('@')[0];

// Numero geral da clinica (com DDD)
const NUMERO_GERAL = '556133455701';
const NUMERO_GERAL_FORMATADO = '(61) 3345-5701';

// Mapeamento de owners para identificar qual numero recebeu a tentativa
const OWNER_MAP = {
  '556192894339': 'EEG',
  '556183008973': 'Recepcao',
};

const ownerLabel = OWNER_MAP[owner] || 'Desconhecido';

// Mensagem de auto-resposta
const autoReplyMessage = [
  `Ola! Notamos que voce tentou ligar para nosso numero de ${ownerLabel}.`,
  '',
  'Este numero nao recebe chamadas de voz.',
  `Para falar conosco por telefone, ligue para *${NUMERO_GERAL_FORMATADO}*`,
  `ou envie uma mensagem para wa.me/${NUMERO_GERAL}.`,
  '',
  'Se preferir, responda esta mensagem que atenderemos por aqui!',
].join('\n');

return [{
  json: {
    ...payload,
    _isCallEvent: isCallEvent,
    _callerPhone: callerPhone,
    _callerChatId: callerChatId,
    _owner: owner,
    _ownerLabel: ownerLabel,
    _autoReplyMessage: autoReplyMessage,
    _numeroGeral: NUMERO_GERAL,
  }
}];
