# CLAUDE.md — Connect Schappo

> Lido automaticamente pelo Claude Code. Contexto completo do projeto.

---

## Sobre o Projeto

**Connect Schappo** — Plataforma de atendimento unificada para a Clinica Schappo (EEG em Brasilia). Unifica WhatsApp + Telefonia PABX em um unico painel web. Substitui o Chatwoot.

| Info | Valor |
|------|-------|
| Repositorio | https://github.com/heldermariano/Connect_Schappo |
| Producao | https://connect.clinicaschappo.com |
| Dev server | http://10.150.77.78:3000 |
| Desenvolvedor | Helder Mariano |

### Stack

| Tecnologia | Versao | Uso |
|---|---|---|
| Next.js | 16.1.6 | Framework (App Router + Turbopack) |
| React | 19.2.3 | UI |
| TypeScript | 5.x (strict) | Tipagem |
| Tailwind CSS | 4.x | Estilos |
| PostgreSQL | 16 | Banco (schema: `atd`) |
| pg | 8.18.0 | Client PostgreSQL |
| NextAuth | 4.24.13 | Autenticacao JWT |
| sip.js | 0.21.2 | Softphone WebRTC |
| asterisk-manager | 0.2.0 | Client AMI (Issabel) |
| Docker + Traefik | latest | Deploy producao |

---

## Status das Fases

### Fase 1 — CONCLUIDA

| Sub-fase | Descricao | Status |
|----------|-----------|--------|
| 1A | Infraestrutura (SQL + Next.js + Docker) | DONE |
| 1B | Canal WhatsApp Mensagens (webhooks + SSE + UI) | DONE |
| 1C | Canal Telefonia PABX (AMI listener + chamadas) | DONE |
| 1D | Canal WhatsApp Voz (config Asterisk/SIP) | DONE (config) |
| 1E | Auto-resposta chamadas N8N | DONE (doc) |

### Fase 2 — EM ANDAMENTO

Funcionalidades ja implementadas (alem do plano original da Fase 1):

| Feature | Status |
|---------|--------|
| Login com NextAuth (JWT + bcrypt) | DONE |
| Controle de acesso por grupo de atendimento | DONE |
| Status de presenca (disponivel/pausa/ausente/offline) | DONE |
| Envio de mensagens (texto) via UAZAPI e 360Dialog | DONE |
| Envio de midia (imagens, documentos, audio, video) | DONE |
| Envio de documentos com filename (UAZAPI endpoints especificos) | DONE |
| Atribuicao de conversas a atendentes | DONE |
| Finalizar atendimento (arquiva conversa, reaparece com nova msg) | DONE |
| Busca de exames via # (banco externo NeuroSchappo) | DONE |
| Download e envio de laudos/tracados PDF | DONE |
| Exclusao de conversas e mensagens (admin) | DONE |
| Mencoes (@) em grupos com notificacao sonora | DONE |
| Softphone WebRTC (SIP.js + PJSIP/Issabel) | DONE |
| Tons DTMF no teclado (Web Audio API) | DONE |
| Config SIP em modal overlay | DONE |
| Lista de ramais online (100-120) | DONE |
| Click-to-call via AMI | DONE |
| Contatos (listagem, busca, import CSV Chatwoot) | DONE |
| Edicao de contatos (modal detalhes) | DONE |
| Busca unificada (conversas + contatos salvos) | DONE |
| Lightbox para imagens (fullscreen) | DONE |
| Media proxy com streaming (PDF inline, download docs) | DONE |
| Layout compartilhado (Sidebar + Softphone em todas as telas) | DONE |
| Sync de fotos de contato via UAZAPI | DONE |
| Avatares de participantes em grupos | DONE |

### Pendente / Proximo

| Feature | Detalhes |
|---------|----------|
| Dashboard de metricas | Tempo resposta, volume, SLA |
| Campanhas de mensagens | Envio em massa |
| Fila de atendimento inteligente | Distribuicao automatica |
| Gravacoes de chamadas | Player inline |
| Historico unificado por contato | Timeline cross-channel |

---

## Arquitetura

```
                    ┌──────────────┐      ┌───────────────┐
                    │  WhatsApp    │      │ Linha Telefone │
                    └──┬───────┬──┘      └──────┬────────┘
                       │       │                 │
              mensagens│       │ voz (SIP)       │ voz (PSTN)
                       │       │                 │
              ┌────────▼──┐ ┌──▼──────────┐ ┌───▼──────────┐
              │  UAZAPI    │ │ 360Dialog   │ │   Issabel    │
              │ (EEG+Rec.) │ │ Cloud API   │ │  Asterisk    │
              └──┬─────┬──┘ │ (Geral)     │ └──┬───────────┘
                 │     │    └──┬──────┬───┘    │
        Wh #1   │     │Wh #2  │      │SIP     │ AMI
        (N8N)   │     │       │      │        │
          ┌──────▼┐ ┌─▼───────▼──────▼────────▼───┐
          │  N8N   │ │        Next.js API           │
          │(bot    │ │  /api/webhook/uazapi         │
          │ EEG)   │ │  /api/webhook/360dialog      │
          └────────┘ │  /api/events (SSE)           │
                     └───────────┬─────────────────┘
                                 │
                          ┌──────▼──────┐
                          │  PostgreSQL  │
                          │ schema: atd  │
                          └──────┬──────┘
                                 │
                     ┌───────────▼──────────────────────┐
                     │         Frontend React            │
                     │  Conversas | Chamadas | Contatos  │
                     │  Sidebar   | Softphone WebRTC     │
                     └──────────────────────────────────┘
```

### Numeros WhatsApp

| Numero | Provider | Categoria | Uso |
|--------|----------|-----------|-----|
| 556192894339 | UAZAPI | eeg | EEG (bot N8N) |
| 556183008973 | UAZAPI | recepcao | Recepcao |
| 556133455701 | 360Dialog | geral | Geral + Voz SIP |

---

## Estrutura do Projeto

```
connect-schappo/
├── CLAUDE.md                           # Este arquivo
├── package.json                        # Deps: next, react, pg, next-auth, sip.js, asterisk-manager
├── next.config.ts                      # standalone + allowedDevOrigins
├── tsconfig.json                       # strict, alias @/* → ./src/*
├── Dockerfile                          # Multi-stage Node 20 Alpine
├── docker-compose.yml                  # Producao com Traefik + Let's Encrypt
├── .dockerignore
├── .gitignore
├── .env / .env.local                   # Variaveis de ambiente (NAO commitar)
│
├── docs/
│   ├── CORRECAO_PAYLOAD_UAZAPI.md      # Mapeamento campos UAZAPI (referencia critica)
│   ├── GUIA_AUTORESPOSTA_N8N.md        # Fase 1E: auto-resposta via N8N
│   ├── GUIA_DEPLOY_PRODUCAO.md         # Deploy Docker + Traefik
│   ├── GUIA_DEPLOY_WHATSAPP_VOZ.md     # Fase 1D: SIP + Asterisk + 360Dialog
│   ├── GUIA_WEBRTC_PJSIP.md           # Config PJSIP WebRTC (ramal 250, coexistencia chan_sip)
│   └── MELHORIAS_FASE2.md              # Roadmap Fase 2 (parcialmente implementado)
│
├── sql/
│   ├── 001_schema_atd.sql              # Schema base: atendentes, conversas, mensagens, chamadas
│   ├── 002_auth_atendentes.sql         # username, password_hash, grupo_atendimento
│   ├── 003_participantes_grupo.sql     # participantes_grupo (sync nomes/avatares)
│   ├── 004_mencoes_registrar_mensagem.sql  # Campo mencoes[] + trigger
│   ├── 005_contatos_table.sql          # Tabela contatos (nome, telefone, email, notas)
│   └── 006_softphone_sip_settings.sql  # Campos SIP em atendentes (server, password_encrypted)
│
├── config/
│   ├── pjsip-whatsapp.conf            # Config PJSIP para trunk WhatsApp Voz
│   ├── extensions-whatsapp.conf        # Dialplan [from-whatsapp]
│   ├── 360dialog-calling-settings.json # Config 360Dialog Calling API
│   ├── n8n-call-autoreply.json         # Workflow N8N auto-resposta
│   ├── n8n-call-detection.js           # JS node deteccao de chamada
│   ├── certbot-asterisk.sh             # Cert SSL para Asterisk
│   └── firewall-rules.sh              # UFW rules (SIP, RTP, AMI)
│
├── scripts/
│   └── create-user.ts                  # Criar usuario com senha hash
│
├── public/
│   ├── favicon.svg
│   └── sounds/ringtone.wav            # Toque de chamada
│
└── src/
    ├── middleware.ts                    # Auth JWT: protege rotas, libera webhooks/auth/static
    │
    ├── app/
    │   ├── layout.tsx                  # Root layout: <Providers> (SessionProvider)
    │   ├── page.tsx                    # Redirect → /conversas
    │   ├── globals.css                 # Tailwind CSS
    │   ├── login/page.tsx              # Tela de login (NextAuth credentials)
    │   │
    │   ├── (app)/                      # Route group autenticado
    │   │   ├── layout.tsx              # Server component: force-dynamic + <AppShell>
    │   │   ├── conversas/
    │   │   │   ├── page.tsx            # Lista conversas + mensagens (painel principal)
    │   │   │   └── [id]/page.tsx       # Redirect → /conversas
    │   │   ├── chamadas/page.tsx       # Log de chamadas + status ramais
    │   │   └── contatos/page.tsx       # Lista contatos + modal detalhes
    │   │
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts      # NextAuth handler
    │       ├── events/route.ts                  # SSE stream tempo real
    │       ├── health/route.ts                  # Health check (DB + AMI)
    │       ├── media/[messageId]/route.ts       # Proxy midia (stream + cache 30min)
    │       │
    │       ├── webhook/
    │       │   ├── uazapi/route.ts              # POST: webhook UAZAPI (msg + call)
    │       │   └── 360dialog/route.ts           # GET/POST: webhook 360Dialog (Meta Cloud)
    │       │
    │       ├── conversas/
    │       │   ├── route.ts                     # GET: lista com filtros + JOIN contatos
    │       │   └── [id]/
    │       │       ├── read/route.ts            # PATCH: marcar como lida
    │       │       └── atribuir/route.ts        # PATCH: atribuir atendente
    │       │
    │       ├── mensagens/
    │       │   ├── [conversaId]/route.ts        # GET: mensagens paginadas + mencoes
    │       │   ├── [conversaId]/[msgId]/route.ts # DELETE: excluir mensagem
    │       │   ├── send/route.ts                # POST: enviar texto
    │       │   └── send-media/route.ts          # POST: enviar midia (endpoints UAZAPI especificos)
    │       │
    │       ├── exames/
    │       │   ├── buscar/route.ts              # GET: busca exames no banco externo (NeuroSchappo)
    │       │   └── download/route.ts            # GET: proxy download PDFs (laudo/tracado)
    │       │
    │       ├── chamadas/route.ts                # GET: log chamadas com filtros
    │       ├── calls/originate/route.ts         # POST: click-to-call via AMI
    │       ├── ramais/route.ts                  # GET: lista ramais online (100-120) via AMI
    │       │
    │       ├── contatos/
    │       │   ├── route.ts                     # GET: lista unificada (UNION conversas+participantes+contatos)
    │       │   ├── add/route.ts                 # POST: adicionar contato
    │       │   ├── [id]/route.ts                # GET/PUT: detalhe/editar por telefone
    │       │   ├── import-csv/route.ts          # POST: import CSV Chatwoot
    │       │   └── sync/route.ts                # POST: sync fotos UAZAPI
    │       │
    │       └── atendentes/
    │           ├── sip/route.ts                 # GET/PUT: config SIP (encrypted)
    │           └── status/route.ts              # GET/PATCH: presenca operador
    │
    ├── components/
    │   ├── Providers.tsx                # SessionProvider wrapper
    │   ├── Logo.tsx                     # Logo SVG (dark/light, sm/md/lg)
    │   │
    │   ├── layout/
    │   │   ├── AppShell.tsx             # Client: Sidebar + content + Softphone(dynamic, no SSR)
    │   │   ├── Sidebar.tsx              # Nav vertical: conversas, chamadas, contatos, logout
    │   │   └── Header.tsx               # Busca + status presenca + usuario
    │   │
    │   ├── chat/
    │   │   ├── ConversaList.tsx          # Lista de conversas
    │   │   ├── ConversaItem.tsx          # Item conversa (avatar, nome, preview, badge)
    │   │   ├── MessageView.tsx           # Area de mensagens + header contato
    │   │   ├── MessageBubble.tsx         # Balao de mensagem (texto, midia, mencoes)
    │   │   ├── MessageInput.tsx          # Input texto + attachments multiplos (16MB max)
    │   │   ├── MediaPreview.tsx          # Preview: imagem, audio, video, documento, sticker
    │   │   ├── ImageLightbox.tsx         # Modal fullscreen para imagens
    │   │   ├── AttachmentPreview.tsx     # Preview arquivo antes de enviar
    │   │   ├── ExameSearch.tsx           # Busca exames via # (popup, download PDFs)
    │   │   └── AtribuirDropdown.tsx      # Dropdown atribuir conversa a atendente
    │   │
    │   ├── calls/
    │   │   ├── CallLog.tsx               # Lista historico chamadas
    │   │   ├── CallItem.tsx              # Item chamada (direcao, duracao, status)
    │   │   ├── CallAlert.tsx             # Alerta chamada ativa
    │   │   ├── CallButton.tsx            # Botao ligar (dispara softphone)
    │   │   └── RamalStatus.tsx           # Status ramal (online/offline)
    │   │
    │   ├── softphone/
    │   │   ├── Softphone.tsx             # Painel softphone completo
    │   │   ├── DialPad.tsx               # Teclado numerico (DTMF tones via Web Audio API)
    │   │   ├── CallDisplay.tsx           # Display chamada (numero, duracao)
    │   │   ├── CallControls.tsx          # Mute, hold, DTMF
    │   │   ├── SipStatus.tsx             # Indicador registro SIP
    │   │   ├── SipSettings.tsx           # Config servidor SIP (modal overlay)
    │   │   └── RamaisList.tsx            # Lista ramais online 100-120 (auto-refresh 15s)
    │   │
    │   ├── contatos/
    │   │   ├── ContatoList.tsx            # Lista com infinite scroll
    │   │   ├── ContatoItem.tsx            # Item contato
    │   │   ├── ContatoDetailModal.tsx     # Modal detalhes/edicao
    │   │   ├── AddContatoModal.tsx        # Modal novo contato
    │   │   └── ImportCsvModal.tsx         # Import CSV Chatwoot
    │   │
    │   ├── filters/
    │   │   ├── CategoryFilter.tsx         # Filtro: Todos/Individual/Grupo EEG/Grupo Recepcao
    │   │   └── SearchBar.tsx              # Campo busca nome/telefone
    │   │
    │   └── ui/
    │       ├── Avatar.tsx                 # Avatar com fallback iniciais + cor por hash
    │       ├── StatusBadge.tsx            # Badge presenca (verde/amarelo/vermelho/cinza)
    │       └── StatusSelector.tsx         # Dropdown mudar status
    │
    ├── hooks/
    │   ├── useSSE.ts                     # SSE /api/events (auto-reconnect 3s)
    │   ├── useConversas.ts               # Fetch + filtro conversas
    │   ├── useMensagens.ts               # Fetch + paginacao + envio mensagens
    │   ├── useChamadas.ts                # Fetch + filtro chamadas
    │   ├── useContatos.ts                # Fetch + busca + sync contatos
    │   └── useSipPhone.ts                # SIP completo: register, call, hold, mute, DTMF
    │
    ├── contexts/
    │   └── AppContext.tsx                 # operatorStatus compartilhado (Header ↔ Softphone)
    │
    ├── lib/
    │   ├── db.ts                         # pg.Pool (search_path = atd)
    │   ├── db-exames.ts                  # pg.Pool externo (neuro_schappo, read-only, max 5)
    │   ├── auth.ts                       # NextAuth config (CredentialsProvider, JWT 12h)
    │   ├── types.ts                      # Interfaces: Conversa, Mensagem, Chamada, Contato, etc.
    │   ├── sse-manager.ts                # Broadcast SSE server-side
    │   ├── ami-listener.ts               # Asterisk AMI: Newchannel → Hangup lifecycle
    │   ├── webhook-parser-uazapi.ts      # Parser UAZAPI → schema atd
    │   ├── webhook-parser-360.ts         # Parser 360Dialog (Meta Cloud API) → schema atd
    │   ├── sip-config.ts                 # AES-256-GCM encrypt/decrypt SIP passwords
    │   ├── notification.ts               # Beep (Web Audio 880Hz) + toast mencao
    │   └── participant-cache.ts          # Cache participantes grupo (mencoes → nomes)
    │
    └── types/
        └── asterisk-manager.d.ts         # Type defs para asterisk-manager
```

---

## Banco de Dados

### Conexao

```
postgresql://connect_dev:SENHA@localhost:5432/connect_schappo
Schema: atd
```

### Tabelas (6)

| Tabela | Descricao | Colunas-chave |
|--------|-----------|---------------|
| `atd.atendentes` | Operadores/atendentes | id, nome, username, password_hash, ramal, grupo_atendimento, role, status_presenca, sip_* |
| `atd.conversas` | Chats WhatsApp | id, wa_chatid (UNIQUE), tipo, categoria, provider, telefone, nao_lida, atendente_id, is_archived |
| `atd.mensagens` | Mensagens | id, conversa_id (FK), wa_message_id (UNIQUE), from_me, tipo_mensagem, conteudo, media_*, mencoes[] |
| `atd.chamadas` | Log chamadas | id, conversa_id, origem, direcao, caller/called_number, status, duracao_seg, asterisk_id |
| `atd.contatos` | Contatos salvos | id, nome, telefone (UNIQUE), email, notas, chatwoot_id |
| `atd.participantes_grupo` | Membros de grupos | id, wa_phone + wa_chatid (UNIQUE), nome_whatsapp, avatar_url |

### Funcoes SQL

| Funcao | Descricao |
|--------|-----------|
| `atd.upsert_conversa()` | Insert/update conversa por wa_chatid |
| `atd.registrar_mensagem()` | Insert mensagem + update conversa (ultima_msg, nao_lida) |

### Migracoes: `sql/001` a `sql/006` (executar em ordem)

---

## API Routes — Referencia Rapida

### Webhooks (publicos)

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/webhook/uazapi` | POST | Recebe msg + call UAZAPI (valida token) |
| `/api/webhook/360dialog` | GET/POST | Recebe msg 360Dialog (Meta Cloud API) |

### Conversas e Mensagens (autenticado)

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/conversas` | GET | Lista com filtros (categoria, tipo, busca) + JOIN contatos |
| `/api/conversas/[id]/read` | PATCH | Marcar como lida |
| `/api/conversas/[id]/atribuir` | PATCH | Atribuir atendente / finalizar (is_archived) |
| `/api/conversas/[id]` | DELETE | Excluir conversa (admin) |
| `/api/mensagens/[conversaId]` | GET | Mensagens paginadas (cursor) + mencoes resolvidas |
| `/api/mensagens/[conversaId]/[msgId]` | DELETE | Excluir mensagem (admin) |
| `/api/mensagens/send` | POST | Enviar texto via UAZAPI ou 360Dialog |
| `/api/mensagens/send-media` | POST | Enviar midia (endpoints UAZAPI especificos + 360Dialog) |

### Exames (autenticado)

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/exames/buscar` | GET | Busca exames por nome no banco externo (NeuroSchappo) |
| `/api/exames/download` | GET | Proxy download PDF (laudo/tracado) com validacao de URL |

### Chamadas

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/chamadas` | GET | Log com filtros (origem, status) |
| `/api/calls/originate` | POST | Click-to-call via AMI |
| `/api/ramais` | GET | Lista ramais online (100-120) via AMI |

### Contatos

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/contatos` | GET | Lista unificada (UNION 3 fontes) com busca |
| `/api/contatos/add` | POST | Criar contato manual |
| `/api/contatos/[id]` | GET/PUT | Detalhe/editar por telefone |
| `/api/contatos/import-csv` | POST | Import CSV Chatwoot (batch upsert) |
| `/api/contatos/sync` | POST | Sync fotos UAZAPI |

### Outros

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/events` | GET | SSE stream (nova_mensagem, conversa_atualizada, chamada_*, atendente_status) |
| `/api/health` | GET | Health check (DB + AMI) |
| `/api/media/[messageId]` | GET | Proxy midia com cache + retry URL expirada |
| `/api/atendentes/sip` | GET/PUT | Config SIP (password AES encrypted) |
| `/api/atendentes/status` | GET/PATCH | Presenca operador + AMI queue pause |

---

## APIs Externas

### UAZAPI (numeros EEG + Recepcao)

- **Base URL**: `UAZAPI_URL` | **Auth**: Header `token`
- Endpoints envio: `/send/text`, `/send/image`, `/send/document`, `/send/audio`, `/send/video`
- **IMPORTANTE**: Usar endpoints especificos por tipo (nao `/send/media`) para que filename funcione
- Campo `filename` no body de `/send/document` para titulo do PDF no WhatsApp
- Webhook valida `payload.token` vs `WEBHOOK_SECRET`
- Ver `docs/CORRECAO_PAYLOAD_UAZAPI.md` para mapeamento de campos

### 360Dialog (numero Geral)

- **Base URL**: `https://waba-v2.360dialog.io` | **Auth**: Header `D360-API-KEY`
- Payload segue padrao Meta Cloud API
- Webhook GET valida `hub.verify_token` vs `WEBHOOK_SECRET`
- Suporta Calling API (SIP) no numero 556133455701

### Issabel/Asterisk AMI

- **Host**: `AMI_HOST:5038` | **Auth**: `AMI_USER`/`AMI_PASSWORD`
- Eventos: Newchannel → DialBegin → BridgeEnter → Hangup
- Origem: `from-whatsapp` = whatsapp, `from-external` = telefone
- Lib: `asterisk-manager` npm

### Issabel/Asterisk — Configuracao WebRTC (PJSIP)

O softphone WebRTC usa **PJSIP** para o ramal 250, enquanto os ramais tradicionais (100-120) continuam em **chan_sip**. A coexistencia funciona via `preload` do PJSIP no `modules.conf`.

**Servidor**: `10.150.77.91` (Issabel 4, Asterisk 16.21.1)

| Componente | Driver | Transporte |
|---|---|---|
| Ramais 100-120 (telefones/MicroSIP) | chan_sip | UDP (porta 5060) |
| Ramal 250 (WebRTC/Connect Schappo) | PJSIP | WSS (porta 8089 via HTTP server) |
| Trunks telefonia | chan_sip | UDP |

**Arquivos de configuracao no Asterisk**:

| Arquivo | Conteudo |
|---|---|
| `/etc/asterisk/pjsip_custom.conf` | Endpoint 250 WebRTC (`webrtc=yes`, `direct_media=no`, `dtls_verify=no`) |
| `/etc/asterisk/sip_custom.conf` | Apenas `[general](+)` com stunaddr (ramal 250 removido) |
| `/etc/asterisk/modules.conf` | `preload => res_pjsip.so` + `preload => res_pjsip_transport_websocket.so` |

**Config PJSIP (`pjsip_custom.conf`)**:
```ini
[auth250]
type=auth
auth_type=userpass
username=250
password=Schappo250

[250]
type=aor
max_contacts=5
remove_existing=yes
qualify_frequency=30

[250]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw
webrtc=yes
direct_media=no
auth=auth250
aors=250
callerid="Connect Schappo" <250>
dtmf_mode=rfc4733
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
dtls_verify=no
```

**O que `webrtc=yes` ativa automaticamente**: `rtcp_mux=yes`, `ice_support=yes`, `use_avpf=yes`, `media_encryption=dtls`, `dtls_auto_generate_cert=yes`, `media_use_received_transport=yes`, `bundle=yes`

**IMPORTANTE — Por que PJSIP e nao chan_sip**: WebRTC exige `rtcp-mux` (multiplexar RTCP na mesma porta do RTP). chan_sip nao suporta rtcp-mux. Sem isso, o browser rejeita o SDP com: `"RTCP-MUX is not enabled when it is required"`.

**IMPORTANTE — Preload obrigatorio**: Sem os preloads, chan_sip registra o handler WebSocket 'sip' primeiro e PJSIP fica "Not Running". Com preload, PJSIP carrega antes e controla o WebSocket.

**Config do softphone no Connect Schappo**: Servidor `10.150.77.91`, Porta `8089`, Transporte `wss`, Usuario `250`

Ver `docs/GUIA_WEBRTC_PJSIP.md` para detalhes completos de configuracao e troubleshooting.

---

## SSE — Eventos Tempo Real

Endpoint: `GET /api/events` (TextEventStream, auto-reconnect 3s)

| Evento | Data | Trigger |
|--------|------|---------|
| `nova_mensagem` | conversa_id, mensagem | Webhook recebe msg |
| `conversa_atualizada` | conversa_id, ultima_msg, nao_lida | Webhook ou acao usuario |
| `chamada_nova` | chamada | AMI Newchannel ou webhook call |
| `chamada_atualizada` | chamada_id, status, duracao | AMI BridgeEnter/Hangup |
| `ramal_status` | ramal, status | AMI DeviceStateChange |
| `atendente_status` | atendente_id, presenca | PATCH /api/atendentes/status |

---

## Variaveis de Ambiente

```env
# PostgreSQL
DATABASE_URL=postgresql://connect_dev:SENHA@localhost:5432/connect_schappo

# UAZAPI
UAZAPI_URL=https://schappo.uazapi.com
UAZAPI_TOKEN=token_default
UAZAPI_INSTANCE_TOKENS=token1,token2  # Tokens por instancia

# 360Dialog
DIALOG360_API_URL=https://waba-v2.360dialog.io
DIALOG360_API_KEY=chave_api

# Mapeamento Owners
OWNER_EEG=556192894339
OWNER_RECEPCAO=556183008973
OWNER_GERAL=556133455701

# Issabel AMI
AMI_HOST=ip_servidor
AMI_PORT=5038
AMI_USER=admin
AMI_PASSWORD=senha

# Seguranca
WEBHOOK_SECRET=token_validacao
SIP_ENCRYPTION_KEY=chave_aes_256

# NextAuth
NEXTAUTH_SECRET=jwt_secret
NEXTAUTH_URL=https://connect.clinicaschappo.com

# Banco externo de exames (NeuroSchappo — somente leitura)
EXAMES_DB_HOST=10.150.77.77
EXAMES_DB_PORT=5432
EXAMES_DB_NAME=neuro_schappo
EXAMES_DB_USER=neuro_schappo
EXAMES_DB_PASSWORD=senha

# App
NEXT_PUBLIC_APP_URL=http://10.150.77.78:3000
NEXT_PUBLIC_APP_NAME=Connect Schappo
```

---

## Deploy

- **Producao**: Docker + Traefik (SSL auto Let's Encrypt) em `connect.clinicaschappo.com`
- **Dev**: `npm run dev` porta 3000 (Turbopack)
- **Build**: `npm run build` (standalone output)
- Ver `docs/GUIA_DEPLOY_PRODUCAO.md` para procedimento completo

---

## Convencoes

- **Codigo**: ingles | **Comentarios/UI/Banco**: portugues
- **CSS**: Tailwind utility-first (sem CSS modules)
- **Componentes**: Client Components (`'use client'`) para interatividade, Server Components para layout
- **Softphone**: Import dinamico (`next/dynamic`, `ssr: false`) — sip.js usa APIs do browser
- **Layout**: Route group `(app)` com `force-dynamic` para evitar cache estatico

---

## Regras Importantes

1. **NUNCA alterar fluxo N8N** — Bot EEG funciona via webhook #1 independente
2. **Schema `atd` sempre** — Nunca usar schema `public`
3. **Webhooks rapidos** — Retornar 200 OK imediato, processar async
4. **SSE com reconexao** — Auto-reconnect 3s no frontend
5. **Idempotencia** — wa_message_id UNIQUE, ON CONFLICT DO NOTHING
6. **Softphone sem SSR** — Sempre usar `dynamic()` com `ssr: false` para sip.js
7. **Finalizar = arquivar** — `is_archived = TRUE` oculta da lista; webhooks resetam para `FALSE` ao receber nova msg
8. **UAZAPI endpoints especificos** — Usar `/send/document`, `/send/image`, etc. (nao `/send/media`) para filename funcionar

---

## Documentacao Complementar

| Documento | Conteudo |
|-----------|----------|
| `docs/CORRECAO_PAYLOAD_UAZAPI.md` | Mapeamento de campos UAZAPI real vs esperado (CRITICO) |
| `docs/GUIA_DEPLOY_PRODUCAO.md` | Procedimento deploy Docker + Traefik |
| `docs/GUIA_DEPLOY_WHATSAPP_VOZ.md` | Config SIP + Asterisk + 360Dialog Calling |
| `docs/GUIA_WEBRTC_PJSIP.md` | Config PJSIP WebRTC no Issabel (ramal 250, coexistencia chan_sip) |
| `docs/GUIA_AUTORESPOSTA_N8N.md` | Workflow N8N auto-resposta chamadas |
| `docs/MELHORIAS_FASE2.md` | Roadmap original Fase 2 (parcialmente feito) |

---

## Contexto do Negocio

Clinica Schappo realiza exames EEG (eletroencefalograma) em Brasilia. Tecnicos (Renata, Paula, Jefferson, Claudia) usam maletas portateis. Comunicacao com pacientes via WhatsApp (3 numeros) e telefone PABX (Issabel).

### Sistemas Relacionados (nao alterar)

| Sistema | Funcao |
|---------|--------|
| Neuro Schappo | Gestao equipamentos EEG (PG: neuro_schappo em 10.150.77.77) — Connect consulta exames via db-exames.ts |
| Bot EEG | Automacao WhatsApp (N8N webhook #1 UAZAPI) |
| Chatwoot | Atendimento atual — sera desligado apos migracao |
| Issabel PBX | Telefonia clinica (Asterisk bare metal) |
