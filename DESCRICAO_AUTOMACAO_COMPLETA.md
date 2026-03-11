# Automação WhatsApp — Descrição Completa e Plano de Migração para Connect Schappo

---

## 1. Visão Geral da Arquitetura Atual

A automação funciona com **4 workflows N8N** encadeados:

```
UAZAPI / 360Dialog (webhook)
         │
         ▼
┌─────────────────────────┐
│ WF-01: ENTRADA           │  Recebe tudo, normaliza, filtra, roteia
│ (Whatsapp - 01)          │
└────┬─────────────┬───────┘
     │             │
     ▼             ▼
┌─────────┐  ┌──────────────────────┐
│ WF-02   │  │ WF-04: AUTOMAÇÕES    │  Bot EEG (hub de equipamentos)
│ RECEB.  │  │ (Whatsapp - 04)      │  Menus, plantão, exames, etc.
│ Chatwoot│  │ V3.0                 │
└─────────┘  └──────────────────────┘
                    │
                    ▼ (360Dialog API)
              Envia resposta ao técnico
              (botões, listas, texto)

┌─────────────────────────┐
│ WF-03: SAÍDA             │  Chatwoot → WhatsApp (quando atendente responde)
│ (Whatsapp - 03)          │
└─────────────────────────┘
```

---

## 2. WF-01: Entrada (Detalhamento)

### Fluxo completo:

```
Webhook UAZAPI/360Dialog
    │
    ▼
[Code] Normalizar Payload
    │  - Detecta plataforma (uazapi/360dialog)
    │  - Ignora webhooks do Chatwoot
    │  - Ignora fromMe, EventType != 'messages'
    │  - Normaliza telefone (adiciona 55, 9, limpa)
    │  - Mapeia owner → inbox (EEG=5, Recepção=4, Geral=8)
    │  - Grupos → inbox separado (Recepção→10, EEG→11)
    │  - Extrai: contactPhone, senderPhone, content, messageType
    │  - Extrai avatarUrl, groupName, mediaUrl
    │  - Prepara contactCache (LID → phone para grupos)
    │  - Retorna: { skip, message, contactCache }
    │
    ▼
[IF] Deve Cachear? (contactCache.shouldCache === true)
    │
    ├── SIM → [PostgreSQL] INSERT no cache de contatos LID → telefone
    │         (para resolver nomes em grupos)
    │
    ▼
[IF] Skip Message? (skip === true)
    │
    ├── SIM → [Respond] 200 OK (ignora)
    │
    ▼ NÃO
[IF] Mensagem Válida? (tem contactPhone && tem content/media)
    │
    ├── NÃO → [Respond] Skip
    │
    ▼ SIM
[Code] Verificar Hub Automações
    │  - Se inboxId !== 8 (Geral/360Dialog) → NÃO redireciona
    │  - Se inboxId === 8 E telefone está na lista USUARIOS_HUB → redireciona
    │  - Lista hardcoded de 20 técnicos cadastrados
    │
    ▼
[IF] Redirecionar para Hub?
    │
    ├── SIM → [Respond Hub] + [Execute WF-04: Automações] ← BOT EEG
    │
    ▼ NÃO
[Redis] Salvar mensagem normalizada
    │
    ▼
[Respond Sucesso] 200 OK
    │
    ▼
[Execute WF-02: Recebimento] → Chatwoot (exibe no painel de atendimento)
```

### Campos normalizados (output do Normalizar Payload):

```javascript
{
  skip: false,
  message: {
    messageId: "556192894339:4AF07FA16B4843F9853D",
    platform: "uazapi",              // ou "360dialog"
    owner: "556192894339",
    inboxId: 5,                      // 4=Recepção, 5=EEG, 8=Geral, 10=GrpRec, 11=GrpEEG
    inboxName: "EEG",
    isGroup: true,
    contactPhone: "120363400460335306@g.us",  // ou "5561999999999"
    contactName: "CLAUDIA DOMINGO",
    groupId: "120363400460335306@g.us",
    groupName: "CLAUDIA DOMINGO",
    avatarUrl: "https://pps.whatsapp.net/...",
    senderPhone: "5561991827054",
    senderName: "Claudia Santrib",
    content: "*EEG 21/02/2026 - Claudia*\n\n🧠 Paciente...",
    messageType: "text",             // text, image, audio, video, document, location
    hasMedia: false,
    mediaUrl: null,
    mimeType: null,
    fileName: null,
    buttonId: null,                  // ID do botão clicado (se interativo)
    buttonTitle: null,
    latitude: null,                  // Se localização
    longitude: null,
    timestamp: 1771712966000,
    receivedAt: "2026-02-22T..."
  },
  contactCache: {
    shouldCache: true,
    lid: "88807777009685@lid",
    phoneNumber: "5561991827054",
    pushName: "Claudia Santrib",
    groupId: "120363400460335306@g.us",
    owner: "556192894339"
  }
}
```

### Mapeamento de Inboxes:

| Owner | InboxId | Nome | Grupos → InboxId |
|---|---|---|---|
| 556192894339 | 5 | EEG | 11 (Grupos EEG) |
| 556183008973 | 4 | Recepção | 10 (Grupos Recepção) |
| 556133455701 | 8 | Geral (360Dialog) | — |

### Lista de técnicos no Hub (USUARIOS_HUB):

```
5561981220485, 5561991495059, 5561981573841, 5561996628353,
5561991474378, 5561996638353, 5561992349256, 5561996714043,
5561981147689, 5561984958038, 5561996723612, 5562994449267,
5561991827054, 5565992456963, 5565992707250, 5548988166469,
5591982105285, 5561999313834, 5561982081494, 5561981573841
```

Esses telefones, quando enviam mensagem pelo número **Geral (360Dialog)**, são redirecionados para o **WF-04 (Bot EEG)**.

---

## 3. WF-04: Automações V3.0 (Bot EEG — Detalhamento)

### Fluxo completo:

```
[Trigger] Recebe dados do WF-01
    │
    ▼
[Code] Verificar Duplicata
    │  - Detecta estrutura (webhook processado, 360dialog raw, UAZAPI raw)
    │  - Extrai: telefone, content, buttonId, tipoInteracao, messageId
    │  - Gera uniqueId para dedup
    │
    ▼
[Redis] Verificar se já processou (key: hub_eeg:msg:{uniqueId})
    │
    ▼
[IF] Já Processou?
    │
    ├── SIM → [Redis] Registrar (TTL) e PARAR
    │
    ▼ NÃO
[PostgreSQL] Buscar Usuário
    │  Query: SELECT * FROM hub_usuarios WHERE telefone LIKE '%{ultimos11}%' AND ativo = true
    │  Retorna: id, nome, telefone, cargo, setor, is_admin, permissoes_eeg
    │
    ▼
[PostgreSQL] Buscar Sessão Ativa
    │  Query: SELECT sessão de retirada/empréstimo ativa para este telefone
    │  Retorna: sessao_id, caixa_codigo, status, itens_selecionados, etc.
    │
    ▼
[Code] Preparar Contexto (6.828 linhas!)
    │  ═══════════════════════════════════════
    │  O CÉREBRO DO BOT
    │  ═══════════════════════════════════════
    │  
    │  [SHARED] Constantes: caixas restritas, regiões, tipos atendimento, itens
    │  [SHARED] Config: notificações, supervisor (Dany), horário comercial
    │  [SHARED] Permissões: isTecnico, isSupervisor, isAdmin
    │  
    │  [ROUTER] Roteador Principal:
    │    1. buttonId → ROTAS_BUTTON (rotas exatas: ~50 handlers)
    │    2. buttonId → ROTAS_REGEX (rotas regex: ~70 patterns)
    │    3. Localização → handleLocalizacao()
    │    4. Input numérico + contexto → handleSelecaoModems()
    │    5. QR Code (EEG-C##-XXXXXXXX) → handleQRCode()
    │    6. Código de item → handleCodigoItem()
    │    7. Texto + sessão ativa → handleTextoComSessao()
    │    8. Saudação → handleSaudacao()
    │    9. Fallback → Menu principal
    │  
    │  Saída: { respostaJSON, executarSQLAntes, sqlQueryAntes, ... }
    │
    ▼
[PostgreSQL] Executar SQL Antes
    │  Query dinâmica: {{ $json.sqlQueryAntes }}
    │  (INSERT/UPDATE de sessões, retiradas, devoluções, exames)
    │
    ▼
[Code] Tratar Resultado SQL (7.326 linhas!)
    │  ═══════════════════════════════════════
    │  O PÓS-PROCESSADOR
    │  ═══════════════════════════════════════
    │  
    │  Recebe o resultado do SQL e o contexto do Preparar Contexto
    │  Monta a resposta final (mensagem + botões/lista)
    │  
    │  Handlers por ação SQL:
    │  - criar_sessao_retirada → mostra caixas disponíveis
    │  - confirmar_retirada → confirmação + notifica supervisor
    │  - registrar_exame → mostra status do exame
    │  - finalizar_plantao → resumo do plantão
    │  - reportar_problema → registra e notifica
    │  - etc. (~80+ handlers de resultado)
    │  
    │  Saída: { telefone, respostaJSON: { mensagem, botoes, lista } }
    │
    ▼
[Code] Montar Payload WhatsApp
    │  Converte respostaJSON para formato 360Dialog API:
    │  - Botão de localização (location_request_message)
    │  - Lista interativa (max 10 itens, max 24 chars título)
    │  - Botões (max 3 botões, max 20 chars)
    │  - Texto simples (fallback)
    │
    ▼
[HTTP] Enviar Interativo
    │  POST https://waba-v2.360dialog.io/messages
    │  Header: D360-API-KEY
    │  Body: payload montado
    │
    ▼
    Técnico recebe resposta no WhatsApp
```

### Módulos do Bot (handlers no Preparar Contexto):

| Módulo | Fluxo | Handlers | Função |
|---|---|---|---|
| **Menu** | — | `handleMenuPrincipal`, `handleMenuEEG` | Menu inicial com opções |
| **Plantão** | F7 | `handlePlantao*` (10+) | Iniciar/finalizar turno do técnico |
| **Retirada** | F1 | `handleRetirada*` (6+) | Técnico retira caixa de equipamento |
| **Devolução** | F2 | `handleDevolucao*` (10+) | Técnico devolve caixa |
| **Empréstimo** | F4 | `handleEmprestimo*` (6+) | Empréstimo entre técnicos |
| **Bloqueio** | F9 | `handleBloqueio*` (4+) | Bloquear/desbloquear caixa |
| **Exames** | F8 | `handleExame*` (15+) | Registrar/finalizar exames EEG |
| **Reportar** | F3 | `handleReportar*` (8+) | Reportar defeito/falta de item |
| **Manutenção** | F5 | `handleManut*` (15+) | Supervisor gerencia manutenções |
| **Relatórios** | F6 | `handleRel*` (8+) | Status equipamentos, histórico, etc. |

### Banco de dados utilizado (schema public):

| Tabela | Função |
|---|---|
| `hub_usuarios` | Técnicos cadastrados (telefone, cargo, permissões) |
| `eeg_sessao_retirada` | Sessões ativas de retirada/devolução |
| `eeg_caixas` | Status das caixas (C1-C16) |
| `eeg_itens` | Itens dentro de cada caixa |
| `eeg_itens_padrao` | Lista padrão de 13 itens por caixa |
| `eeg_movimentacoes` | Histórico de movimentação |
| `eeg_emprestimos` | Empréstimos entre técnicos |
| `eeg_exames` | Registro de exames realizados |
| `eeg_problemas` | Problemas reportados |
| `eeg_manutencoes` | Manutenções em andamento |
| `eeg_plantao` | Turnos dos técnicos |
| `eeg_localizacoes` | Localizações GPS dos técnicos |

---

## 4. WF-02: Recebimento (Chatwoot)

Recebe a mensagem normalizada do WF-01 e a envia para o Chatwoot:

```
[Redis] Buscar mensagem → [Parse] → [Buscar/Criar Contato Chatwoot]
    → [Buscar/Criar Conversa] → [Enviar Mensagem no Chatwoot]
    → Se tem mídia: [Download UAZAPI/360Dialog] → [Enviar Attachment]
```

**Na migração para Connect Schappo, este workflow será SUBSTITUÍDO** pelo parser do webhook que persiste direto no banco `atd`.

---

## 5. WF-03: Saída (Chatwoot → WhatsApp)

Quando um atendente responde pelo Chatwoot:

```
[Webhook Chatwoot Outgoing] → [Parse] → [Mapear Inbox → Plataforma]
    → [Se UAZAPI] → POST UAZAPI /send/text ou /send/media
    → [Se 360Dialog] → POST 360Dialog /messages
```

**Na migração, será SUBSTITUÍDO** pelo endpoint de envio do Connect Schappo (Fase 2).

---

## 6. Plano de Migração para Connect Schappo

### 6.1 O que NÃO muda

O **WF-04 (Automações)** continua funcionando exatamente como está. Ele é o bot EEG e é independente do Chatwoot. A migração afeta apenas o fluxo de entrada e saída de mensagens no painel.

### 6.2 O que muda

```
ANTES (com Chatwoot):
  Webhook → WF-01 → WF-02 (Chatwoot) + WF-04 (Bot)
                   → WF-03 (Chatwoot → WhatsApp)

DEPOIS (com Connect Schappo):
  Webhook → WF-01 (modificado) → WF-04 (Bot, SEM MUDANÇA)
  Webhook → Connect Schappo (webhook paralelo, persiste no banco atd)
  Connect Schappo → WhatsApp (envio direto, sem Chatwoot)
```

### 6.3 Alterações necessárias no WF-01

#### Opção A: Webhook duplicado (RECOMENDADO)

A UAZAPI suporta **dois webhooks** simultâneos. Configurar:

- **Webhook #1**: N8N (existente) → `https://n8n.clinicaschappo.com/webhook/whatsapp-webhook`
- **Webhook #2**: Connect Schappo → `https://connect.clinicaschappo.com/api/webhook/uazapi`

Assim o N8N continua recebendo e o WF-04 funciona sem alteração. O Connect Schappo recebe em paralelo e persiste no banco `atd`.

**Nenhuma alteração no WF-01 é necessária nesta opção.**

#### Opção B: WF-01 envia para Connect Schappo

Adicionar um nó HTTP Request no WF-01, após o "Normalizar Payload":

```
[Normalizar Payload]
    │
    ├── (existente) [IF Skip] → [WF-02] + [WF-04]
    │
    └── (NOVO) [HTTP Request] POST para Connect Schappo
         URL: https://connect.clinicaschappo.com/api/webhook/n8n-bridge
         Body: { message: normalizedMessage }
```

### 6.4 Alterações para 360Dialog

Para o número Geral (360Dialog), precisa configurar **segundo webhook** no 360Dialog:

```
360Dialog Partner Hub:
  Webhook URL 1: https://n8n.clinicaschappo.com/webhook/whatsapp-webhook (existente)
  Webhook URL 2: https://connect.clinicaschappo.com/api/webhook/360dialog (NOVO)
```

Se 360Dialog não suporta dois webhooks, usar a **Opção B** (bridge via N8N).

### 6.5 O que pode ser removido (Fase 3)

Quando o Chatwoot for desligado:

| Componente | Ação |
|---|---|
| WF-02 (Recebimento Chatwoot) | **DELETAR** |
| WF-03 (Saída Chatwoot) | **DELETAR** |
| Nós do Chatwoot no WF-01 | Remover filtro `body.event === 'message_created'` |
| Chatwoot container | **PARAR** |
| Lógica de inboxIds no WF-01 | Substituir por categorias Connect Schappo |
| Redis no WF-01 | Manter (usado pelo WF-04 para dedup) |

### 6.6 WF-04 e Connect Schappo

O WF-04 envia respostas diretamente pela **360Dialog API** (POST /messages). Isso **não depende** do Chatwoot nem do Connect Schappo.

Porém, para o Connect Schappo **ver** as mensagens enviadas pelo bot, existem duas opções:

**Opção 1**: Capturar via webhook UAZAPI/360Dialog (o bot envia, o webhook recebe o status, Connect Schappo persiste como `from_me: true`)

**Opção 2**: Adicionar um nó no WF-04 que notifica o Connect Schappo após enviar:

```javascript
// Após "Enviar Interativo", adicionar:
// HTTP Request → POST connect.clinicaschappo.com/api/webhook/bot-outgoing
// Body: { telefone, mensagem, botoes, timestamp }
```

---

## 7. Resumo das Dependências

```
┌────────────────────┬────────────────────────────────────────────────┐
│ Componente         │ Depende de                                     │
├────────────────────┼────────────────────────────────────────────────┤
│ WF-01 (Entrada)    │ UAZAPI webhook, 360Dialog webhook, Redis      │
│ WF-02 (Chatwoot)   │ WF-01, Chatwoot API, Redis → SERÁ REMOVIDO   │
│ WF-03 (Saída)      │ Chatwoot webhook → SERÁ REMOVIDO              │
│ WF-04 (Bot EEG)    │ WF-01, PostgreSQL (schema public), Redis,     │
│                    │ 360Dialog API (envio), NÃO depende do Chatwoot │
│ Connect Schappo    │ UAZAPI webhook (#2), 360Dialog webhook (#2),  │
│                    │ PostgreSQL (schema atd), SSE                  │
└────────────────────┴────────────────────────────────────────────────┘
```

---

## 8. Variáveis de Ambiente Relevantes

### N8N (WF-01 e WF-04):

```
UAZAPI_BASE_URL=https://schappo.uazapi.com
UAZAPI_TOKEN=6220a163-28da-40dc-ae09-cc2bdbe695f6

360DIALOG_API_URL=https://waba-v2.360dialog.io
360DIALOG_API_KEY=(configurado no nó HTTP)

REDIS_URL=redis://localhost:6379

POSTGRES_HOST=localhost
POSTGRES_DB=clinica_integracao
POSTGRES_USER=(configurado na credential)

CHATWOOT_URL=(será descontinuado)
```

### Connect Schappo (novo):

```
DATABASE_URL=postgresql://connect_dev:SENHA@localhost:5432/connect_schappo
UAZAPI_URL=https://schappo.uazapi.com
UAZAPI_TOKEN=(mesmo token)
DIALOG360_API_URL=https://waba-v2.360dialog.io
DIALOG360_API_KEY=(mesma key)
WEBHOOK_SECRET=6220a163-28da-40dc-ae09-cc2bdbe695f6
```

---

## 9. Cronograma de Migração Sugerido

```
Etapa 1 — AGORA (sem risco)
├── Configurar webhook #2 na UAZAPI → Connect Schappo
├── Mensagens começam a aparecer no painel (read-only)
├── WF-01 + WF-02 + WF-04 continuam funcionando normalmente
└── Chatwoot continua sendo usado para responder

Etapa 2 — Quando Connect Schappo tiver envio (Fase 2)
├── Implementar envio de mensagens no Connect Schappo
├── Testar com usuários internos
├── Gradualmente migrar atendentes do Chatwoot → Connect Schappo
└── WF-03 (Saída Chatwoot) perde relevância

Etapa 3 — Migração completa
├── Desligar WF-02, WF-03
├── Remover filtros de Chatwoot do WF-01
├── Desligar container Chatwoot
├── Opcionalmente: notificar Connect Schappo das mensagens do bot (WF-04)
└── Connect Schappo como painel único
```

---

## 10. Considerações Importantes

1. **O WF-04 NÃO precisa ser alterado** — ele é autossuficiente e envia direto pela 360Dialog API
2. **O Redis continua necessário** — usado pelo WF-04 para deduplicação de mensagens
3. **O banco `clinica_integracao` (schema public) continua** — é onde ficam as tabelas EEG que o WF-04 usa
4. **O banco `connect_schappo` (schema atd) é separado** — apenas para o painel de atendimento
5. **Dois bancos PostgreSQL coexistem**: `clinica_integracao` (bot) e `connect_schappo` (painel)
6. **A lista USUARIOS_HUB no WF-01 é hardcoded** — quando novo técnico entrar, precisa atualizar no código. Futuramente, mover para banco.
7. **O token `body.token` do webhook UAZAPI** (`6220a163-...`) pode ser usado como `WEBHOOK_SECRET` no Connect Schappo para validação.
