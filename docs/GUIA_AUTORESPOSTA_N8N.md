# Guia — Auto-resposta para Chamadas WhatsApp (Fase 1E)

Quando um paciente tenta ligar via WhatsApp para os numeros de **EEG** (556192894339) ou **Recepcao** (556183008973), o sistema detecta o evento e envia automaticamente uma mensagem direcionando para o numero geral **(61) 3345-5701**.

---

## Contexto

Os numeros EEG e Recepcao usam UAZAPI (API nao-oficial) e **nao suportam chamadas de voz**. Apenas o numero Geral (556133455701, via 360Dialog) tem suporte a voz.

Quando alguem tenta ligar para os numeros UAZAPI, a UAZAPI envia um webhook com `EventType: "call"`. Vamos usar isso para disparar a auto-resposta.

---

## Fluxo

```
Paciente tenta ligar (WhatsApp) para numero EEG ou Recepcao
        |
        v
UAZAPI envia webhook com EventType=call
        |
        v
N8N (WF-01) recebe webhook
        |
        v
No "Normalizar Payload" (ja existente)
        |
        v
No "Detectar Chamada" (NOVO — Function)
        |
        v
No "IF" (NOVO) ── isCallEvent = true? ──> No "Auto-resposta" (NOVO — HTTP Request)
        |                                         |
        | false                                   v
        v                               UAZAPI /send/text
  Fluxo normal do bot                   "Ligue para (61) 3345-5701"
  (continua sem alteracao)
```

---

## Passo a Passo no N8N

### Passo 1: Abrir o Workflow WF-01

1. Acessar o painel N8N
2. Abrir o workflow **WF-01** (bot EEG / Recepcao)
3. Localizar o no **"Normalizar Payload"**

### Passo 2: Adicionar no "Detectar Chamada" (Function)

1. Clicar no **+** apos o no "Normalizar Payload"
2. Escolher tipo: **Function**
3. Nome: `Detectar Chamada`
4. Colar o codigo de `config/n8n-call-detection.js`

O codigo adiciona os campos:
- `_isCallEvent` — `true` se for chamada, `false` se for mensagem
- `_callerChatId` — wa_chatid de quem ligou
- `_autoReplyMessage` — mensagem formatada para enviar

### Passo 3: Adicionar no "IF" (condicional)

1. Clicar no **+** apos "Detectar Chamada"
2. Escolher tipo: **IF**
3. Configurar condicao:
   - **Value 1**: `{{$json._isCallEvent}}`
   - **Operation**: `equal`
   - **Value 2**: `true`

### Passo 4: Adicionar no "Auto-resposta Chamada" (HTTP Request)

Na saida **true** do IF:

1. Clicar no **+** na saida "true"
2. Escolher tipo: **HTTP Request**
3. Nome: `Auto-resposta Chamada`
4. Configurar conforme `config/n8n-call-autoreply.json`:

| Campo | Valor |
|-------|-------|
| Method | POST |
| URL | `={{$env.UAZAPI_URL}}/send/text` |
| Header `token` | `={{$env.UAZAPI_TOKEN}}` |
| Header `Content-Type` | `application/json` |
| Body (JSON) | Ver abaixo |

**Body JSON:**
```json
{
  "phone": "={{$json._callerChatId}}",
  "message": "={{$json._autoReplyMessage}}",
  "isGroup": false
}
```

### Passo 5: Reconectar saida "false" ao fluxo existente

Na saida **false** do IF:
1. Conectar ao proximo no do fluxo normal do bot
2. Isso garante que **mensagens normais continuam funcionando** sem alteracao

### Passo 6: Configurar variaveis de ambiente no N8N

Se ainda nao configuradas, adicionar no N8N:
- `UAZAPI_URL` — URL base da instancia UAZAPI
- `UAZAPI_TOKEN` — Token de autenticacao

### Passo 7: Testar

1. Salvar o workflow
2. Ativar o workflow
3. De um celular, tentar ligar via WhatsApp para o numero EEG ou Recepcao
4. Verificar que a mensagem de auto-resposta foi enviada
5. Verificar no log do N8N que o fluxo passou pelo caminho correto

---

## Mensagem Enviada ao Paciente

```
Ola! Notamos que voce tentou ligar para nosso numero de EEG.

Este numero nao recebe chamadas de voz.
Para falar conosco por telefone, ligue para *(61) 3345-5701*
ou envie uma mensagem para wa.me/556133455701.

Se preferir, responda esta mensagem que atenderemos por aqui!
```

A mensagem se adapta automaticamente ao numero que recebeu a tentativa (EEG ou Recepcao).

---

## Diagrama do WF-01 (apos alteracao)

```
Webhook UAZAPI
      |
      v
Normalizar Payload (existente)
      |
      v
Detectar Chamada (NOVO - Function)
      |
      v
IF: isCallEvent? (NOVO)
  |           |
  | true      | false
  v           v
Auto-resp.   Fluxo normal
(HTTP Req)   do bot (existente)
```

---

## Importante

- **NAO alterar** os nos existentes do bot EEG/Recepcao
- Os novos nos sao inseridos **entre** o "Normalizar Payload" e o restante do fluxo
- O IF garante que mensagens normais seguem o caminho original sem nenhuma mudanca
- A auto-resposta so e enviada para **chamadas** (`EventType: "call"`), nunca para mensagens
