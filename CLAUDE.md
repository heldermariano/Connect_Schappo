# CLAUDE.md — Connect Schappo

> Este arquivo é lido automaticamente pelo Claude Code ao iniciar no projeto.
> Contém todo o contexto necessário para desenvolver a plataforma.

---

## 🎯 Sobre o Projeto

**Connect Schappo** é uma plataforma de atendimento unificada para a **Clínica Schappo** (clínica médica de EEG em Brasília). Unifica 3 canais de comunicação em um único painel web:

1. **WhatsApp Mensagens** — via UAZAPI + 360Dialog
2. **WhatsApp Voz** — via 360Dialog Calling API + SIP + Issabel/Asterisk
3. **Telefonia PABX** — via Issabel/Asterisk AMI

A plataforma substitui o Chatwoot (atual, problemático) por uma solução própria em **Next.js + React + TypeScript + Tailwind + PostgreSQL**.

**Repositório**: https://github.com/heldermariano/Connect_Schappo
**Domínio produção**: https://connect.clinicaschappo.com
**Desenvolvedor**: Helder Mariano

---

## 🏗️ Arquitetura

### Visão Geral

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
                 │     │       │      │        │
          ┌──────▼┐ ┌─▼───────▼──────▼────────▼───┐
          │  N8N   │ │        Next.js API           │
          │(bot    │ │  /api/webhook/uazapi         │
          │ EEG)   │ │  /api/webhook/360dialog      │
          └────────┘ │  /api/calls/ami-listener     │
                     │  /api/events (SSE)           │
                     └───────────┬─────────────────┘
                                 │
                          ┌──────▼──────┐
                          │  PostgreSQL  │
                          │ schema: atd  │
                          └──────┬──────┘
                                 │
                          ┌──────▼──────────────────────┐
                          │      Frontend React          │
                          │  💬 Chats  │  📞 Chamadas    │
                          └─────────────────────────────┘
```

### Números WhatsApp da Clínica

| Número | Provider | Uso | Webhook |
|--------|----------|-----|---------|
| 556192894339 | UAZAPI | EEG (bot automático) | N8N (webhook #1) + Next.js (webhook #2) |
| 556183008973 | UAZAPI | Recepção | N8N (webhook #1) + Next.js (webhook #2) |
| 556133455701 | 360Dialog (Cloud API) | Geral | N8N + Next.js + **Chamadas de Voz (SIP)** |

### Mapeamento Owner → Categoria

```typescript
const OWNER_CATEGORY_MAP: Record<string, string> = {
  '556192894339': 'eeg',        // Número EEG
  '556183008973': 'recepcao',   // Número Recepção
  '556133455701': 'geral',      // Número Geral (360Dialog)
};
```

### Identificação de Tipo (individual vs grupo)

```typescript
// wa_chatid contendo '@g.us' = grupo, senão = individual
const tipo = wa_chatid.includes('@g.us') ? 'grupo' : 'individual';
```

---

## 📊 Fases de Desenvolvimento

### FASE 1 — Read-Only + Voz (FASE ATUAL)

Estamos implementando esta fase. Entregáveis:

- **1A. Infraestrutura base** — Schema SQL + Next.js + Docker ✅ Iniciado
- **1B. Canal WhatsApp Mensagens** — Webhooks UAZAPI/360Dialog + parser + SSE + frontend
- **1C. Canal Telefonia PABX** — Issabel AMI listener + log chamadas
- **1D. Canal WhatsApp Voz** — 360Dialog Calling API + SIP + Issabel
- **1E. Auto-resposta chamadas** — N8N detecta evento "call" nos números UAZAPI e envia mensagem direcionando para o nº 3345-5701

**Na Fase 1 o painel é read-only** — visualização e monitoramento apenas. O Chatwoot continua sendo usado para responder (temporariamente).

### FASE 2 — Interação (futuro)
- Responder mensagens pelo painel
- Click-to-call via AMI
- Atribuir atendentes

### FASE 3 — Migração Completa (futuro)
- Desligar Chatwoot
- Dashboard métricas
- Campanhas

---

## 🗄️ Banco de Dados

### Conexão

```
Host:     localhost
Port:     5432
Database: connect_schappo
User:     connect_dev
Schema:   atd
```

**Connection string**: `postgresql://connect_dev:SENHA@localhost:5432/connect_schappo`

### Schema SQL Completo

Executar no banco `connect_schappo`:

```sql
-- =========================================================
-- SCHEMA: atd (atendimento)
-- =========================================================

CREATE SCHEMA IF NOT EXISTS atd;

-- =========================================================
-- TABELA: atd.atendentes
-- =========================================================
CREATE TABLE atd.atendentes (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(200) NOT NULL,
    telefone        VARCHAR(20),
    email           VARCHAR(200),
    ramal           VARCHAR(10),
    ativo           BOOLEAN DEFAULT TRUE,
    role            VARCHAR(30) DEFAULT 'atendente',  -- 'atendente','supervisor','admin'
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- TABELA: atd.conversas
-- Cada chat do WhatsApp (individual ou grupo)
-- =========================================================
CREATE TABLE atd.conversas (
    id              SERIAL PRIMARY KEY,
    wa_chatid       VARCHAR(100) NOT NULL UNIQUE,
    tipo            VARCHAR(20) NOT NULL DEFAULT 'individual',  -- 'individual', 'grupo'
    categoria       VARCHAR(30) NOT NULL DEFAULT 'geral',       -- 'eeg', 'recepcao', 'geral'
    provider        VARCHAR(20) NOT NULL DEFAULT 'uazapi',      -- 'uazapi', '360dialog'
    nome_contato    VARCHAR(200),
    nome_grupo      VARCHAR(200),
    telefone        VARCHAR(20),
    avatar_url      TEXT,
    ultima_mensagem TEXT,
    ultima_msg_at   TIMESTAMPTZ,
    nao_lida        INTEGER DEFAULT 0,
    is_archived     BOOLEAN DEFAULT FALSE,
    is_muted        BOOLEAN DEFAULT FALSE,
    atendente_id    INTEGER REFERENCES atd.atendentes(id),
    labels          TEXT[] DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversas_categoria ON atd.conversas(categoria);
CREATE INDEX idx_conversas_tipo ON atd.conversas(tipo);
CREATE INDEX idx_conversas_provider ON atd.conversas(provider);
CREATE INDEX idx_conversas_ultima_msg ON atd.conversas(ultima_msg_at DESC);
CREATE INDEX idx_conversas_wa_chatid ON atd.conversas(wa_chatid);

-- =========================================================
-- TABELA: atd.mensagens
-- =========================================================
CREATE TABLE atd.mensagens (
    id              SERIAL PRIMARY KEY,
    conversa_id     INTEGER NOT NULL REFERENCES atd.conversas(id) ON DELETE CASCADE,
    wa_message_id   VARCHAR(200) UNIQUE,
    from_me         BOOLEAN DEFAULT FALSE,
    sender_phone    VARCHAR(20),
    sender_name     VARCHAR(200),
    tipo_mensagem   VARCHAR(30) DEFAULT 'text',
                    -- 'text','image','audio','video','document',
                    -- 'location','contact','sticker','reaction'
    conteudo        TEXT,
    media_url       TEXT,
    media_mimetype  VARCHAR(100),
    media_filename  VARCHAR(200),
    is_forwarded    BOOLEAN DEFAULT FALSE,
    quoted_msg_id   VARCHAR(200),
    status          VARCHAR(20) DEFAULT 'received',
                    -- 'received','sent','delivered','read','failed'
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mensagens_conversa ON atd.mensagens(conversa_id, created_at DESC);
CREATE INDEX idx_mensagens_wa_id ON atd.mensagens(wa_message_id);
CREATE INDEX idx_mensagens_created ON atd.mensagens(created_at DESC);

-- =========================================================
-- TABELA: atd.chamadas
-- Log de chamadas (WhatsApp voz + telefonia PABX)
-- =========================================================
CREATE TABLE atd.chamadas (
    id              SERIAL PRIMARY KEY,
    conversa_id     INTEGER REFERENCES atd.conversas(id),
    wa_chatid       VARCHAR(100),
    origem          VARCHAR(20) NOT NULL,
                    -- 'whatsapp' (voz SIP), 'telefone' (PABX),
                    -- 'whatsapp-tentativa' (tentou ligar via UAZAPI)
    direcao         VARCHAR(10) NOT NULL DEFAULT 'recebida',  -- 'recebida', 'realizada'
    caller_number   VARCHAR(30),
    called_number   VARCHAR(30),
    ramal_atendeu   VARCHAR(10),
    atendente_id    INTEGER REFERENCES atd.atendentes(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'ringing',
                    -- 'ringing','answered','missed','rejected',
                    -- 'voicemail','busy','failed'
    duracao_seg     INTEGER DEFAULT 0,
    inicio_at       TIMESTAMPTZ DEFAULT NOW(),
    atendida_at     TIMESTAMPTZ,
    fim_at          TIMESTAMPTZ,
    gravacao_url    TEXT,
    asterisk_id     VARCHAR(100),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chamadas_conversa ON atd.chamadas(conversa_id, created_at DESC);
CREATE INDEX idx_chamadas_origem ON atd.chamadas(origem);
CREATE INDEX idx_chamadas_status ON atd.chamadas(status);
CREATE INDEX idx_chamadas_created ON atd.chamadas(created_at DESC);
CREATE INDEX idx_chamadas_asterisk ON atd.chamadas(asterisk_id);

-- =========================================================
-- FUNÇÃO: atd.upsert_conversa
-- =========================================================
CREATE OR REPLACE FUNCTION atd.upsert_conversa(
    p_wa_chatid VARCHAR,
    p_tipo VARCHAR,
    p_categoria VARCHAR,
    p_provider VARCHAR DEFAULT 'uazapi',
    p_nome_contato VARCHAR DEFAULT NULL,
    p_nome_grupo VARCHAR DEFAULT NULL,
    p_telefone VARCHAR DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO atd.conversas (
        wa_chatid, tipo, categoria, provider,
        nome_contato, nome_grupo, telefone, avatar_url
    )
    VALUES (
        p_wa_chatid, p_tipo, p_categoria, p_provider,
        p_nome_contato, p_nome_grupo, p_telefone, p_avatar_url
    )
    ON CONFLICT (wa_chatid) DO UPDATE SET
        nome_contato = COALESCE(EXCLUDED.nome_contato, atd.conversas.nome_contato),
        nome_grupo = COALESCE(EXCLUDED.nome_grupo, atd.conversas.nome_grupo),
        avatar_url = COALESCE(EXCLUDED.avatar_url, atd.conversas.avatar_url),
        telefone = COALESCE(EXCLUDED.telefone, atd.conversas.telefone),
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- FUNÇÃO: atd.registrar_mensagem
-- =========================================================
CREATE OR REPLACE FUNCTION atd.registrar_mensagem(
    p_conversa_id INTEGER,
    p_wa_message_id VARCHAR,
    p_from_me BOOLEAN,
    p_sender_phone VARCHAR,
    p_sender_name VARCHAR,
    p_tipo_mensagem VARCHAR,
    p_conteudo TEXT,
    p_media_url TEXT DEFAULT NULL,
    p_media_mimetype VARCHAR DEFAULT NULL,
    p_media_filename VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS INTEGER AS $$
DECLARE
    v_msg_id INTEGER;
BEGIN
    INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me,
        sender_phone, sender_name, tipo_mensagem,
        conteudo, media_url, media_mimetype,
        media_filename, metadata
    )
    VALUES (
        p_conversa_id, p_wa_message_id, p_from_me,
        p_sender_phone, p_sender_name, p_tipo_mensagem,
        p_conteudo, p_media_url, p_media_mimetype,
        p_media_filename, p_metadata
    )
    ON CONFLICT (wa_message_id) DO NOTHING
    RETURNING id INTO v_msg_id;

    IF v_msg_id IS NOT NULL THEN
        UPDATE atd.conversas SET
            ultima_mensagem = LEFT(p_conteudo, 200),
            ultima_msg_at = NOW(),
            nao_lida = CASE
                WHEN p_from_me THEN 0
                ELSE nao_lida + 1
            END,
            updated_at = NOW()
        WHERE id = p_conversa_id;
    END IF;

    RETURN COALESCE(v_msg_id, 0);
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- DADOS INICIAIS: Atendentes
-- =========================================================
INSERT INTO atd.atendentes (nome, telefone, ramal) VALUES
('Renata', NULL, '201'),
('Paula', NULL, '202'),
('Jefferson', NULL, '203'),
('Claudia Santrib', NULL, '204')
ON CONFLICT DO NOTHING;
```

---

## 📁 Estrutura do Projeto

```
connect-schappo/
├── CLAUDE.md                        # Este arquivo
├── package.json
├── next.config.js
├── tsconfig.json
├── .env.local                       # Variáveis de ambiente (NÃO commitar)
├── Dockerfile                       # Build para produção
├── docker-compose.yml               # Deploy com Traefik
├── docs/
│   ├── ARQUITETURA_v2.md            # Documento completo de arquitetura
│   └── ATUALIZACAO_DOCKER.md        # Config Docker + Traefik
├── sql/
│   └── 001_schema_atd.sql           # Schema SQL completo
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Layout com sidebar
│   │   ├── page.tsx                 # Redirect → /conversas
│   │   ├── conversas/
│   │   │   ├── page.tsx             # Lista de conversas
│   │   │   └── [id]/
│   │   │       └── page.tsx         # Mensagens da conversa
│   │   ├── chamadas/
│   │   │   └── page.tsx             # Log de chamadas
│   │   └── api/
│   │       ├── webhook/
│   │       │   ├── uazapi/
│   │       │   │   └── route.ts     # POST: webhook UAZAPI
│   │       │   └── 360dialog/
│   │       │       └── route.ts     # POST: webhook 360Dialog
│   │       ├── conversas/
│   │       │   └── route.ts         # GET: lista com filtros
│   │       ├── mensagens/
│   │       │   └── [conversaId]/
│   │       │       └── route.ts     # GET: mensagens
│   │       ├── chamadas/
│   │       │   └── route.ts         # GET: log chamadas
│   │       ├── health/
│   │       │   └── route.ts         # GET: health check
│   │       └── events/
│   │           └── route.ts         # GET: SSE tempo real
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx          # Sidebar com navegação
│   │   │   └── Header.tsx           # Header com busca
│   │   ├── chat/
│   │   │   ├── ConversaList.tsx     # Lista de conversas
│   │   │   ├── ConversaItem.tsx     # Item na lista
│   │   │   ├── MessageView.tsx      # Área de mensagens
│   │   │   ├── MessageBubble.tsx    # Balão individual
│   │   │   └── MediaPreview.tsx     # Preview de mídia
│   │   ├── calls/
│   │   │   ├── CallLog.tsx          # Lista de chamadas
│   │   │   ├── CallItem.tsx         # Item de chamada
│   │   │   ├── CallAlert.tsx        # Alerta chamada ativa
│   │   │   └── RamalStatus.tsx      # Status dos ramais
│   │   └── filters/
│   │       ├── CategoryFilter.tsx   # Individual/EEG/Recepção
│   │       ├── ChannelFilter.tsx    # WhatsApp/Telefone/Todos
│   │       └── SearchBar.tsx        # Busca por nome/telefone
│   ├── hooks/
│   │   ├── useSSE.ts               # Eventos em tempo real
│   │   ├── useConversas.ts         # Lista de conversas
│   │   ├── useMensagens.ts         # Mensagens por conversa
│   │   └── useChamadas.ts          # Log de chamadas
│   ├── lib/
│   │   ├── db.ts                    # Pool PostgreSQL
│   │   ├── uazapi.ts               # Client UAZAPI
│   │   ├── sse-manager.ts          # Gerenciador SSE server
│   │   ├── ami-listener.ts         # Listener AMI do Asterisk
│   │   ├── webhook-parser-uazapi.ts  # Parser payload UAZAPI
│   │   ├── webhook-parser-360.ts     # Parser payload 360Dialog
│   │   └── types.ts                # Tipos TypeScript
│   └── styles/
│       └── globals.css              # Tailwind
```

---

## 🔌 APIs Externas

### UAZAPI (WhatsApp — números EEG + Recepção)

**Base URL**: Configurada em `UAZAPI_URL`
**Auth**: Header `token: {{UAZAPI_TOKEN}}`

#### Endpoints principais usados:

```
POST /send/text          — Enviar mensagem de texto
POST /send/image         — Enviar imagem
POST /send/document      — Enviar documento
POST /send/audio         — Enviar áudio
GET  /chat/find          — Buscar conversas (paginação)
GET  /message/find       — Buscar mensagens (paginação)
POST /webhook            — Configurar webhook
GET  /sse                — Server-Sent Events
```

#### Payload REAL — Mensagem individual:

```json
{
  "BaseUrl": "https://schappo.uazapi.com",
  "EventType": "messages",
  "instanceName": "EEG",
  "owner": "556192894339",
  "token": "TOKEN_DA_INSTANCIA",
  "chatSource": "updated",
  "chat": {
    "wa_chatid": "556191223332@s.whatsapp.net",
    "wa_chatlid": "250624293740768@lid",
    "wa_isGroup": false,
    "wa_contactName": "",
    "wa_name": "",
    "name": "",
    "phone": "556191223332",
    "imagePreview": "",
    "wa_unreadCount": 1
  },
  "message": {
    "id": "556192894339:AC7CFB9E5C7742D8BFE91B9803942A67",
    "messageid": "AC7CFB9E5C7742D8BFE91B9803942A67",
    "chatid": "556191223332@s.whatsapp.net",
    "chatlid": "250624293740768@lid",
    "fromMe": false,
    "type": "text",
    "messageType": "ExtendedTextMessage",
    "text": "Bom dia, gostaria de ter acesso ao exame",
    "content": {
      "text": "Bom dia, gostaria de ter acesso ao exame",
      "contextInfo": { "expiration": 7776000 }
    },
    "sender": "250624293740768@lid",
    "sender_pn": "556191223332@s.whatsapp.net",
    "sender_lid": "250624293740768@lid",
    "senderName": "",
    "isGroup": false,
    "groupName": "Unknown",
    "messageTimestamp": 1771692584000,
    "source": "android",
    "wasSentByApi": false
  }
}
```

#### Payload REAL — Mensagem de grupo:

```json
{
  "BaseUrl": "https://schappo.uazapi.com",
  "EventType": "messages",
  "instanceName": "EEG",
  "owner": "556192894339",
  "token": "TOKEN_DA_INSTANCIA",
  "chatSource": "updated",
  "chat": {
    "wa_chatid": "120363400460335306@g.us",
    "wa_isGroup": true,
    "wa_contactName": "",
    "wa_name": "CLAUDIA DOMINGO",
    "name": "CLAUDIA DOMINGO",
    "phone": "",
    "imagePreview": "https://pps.whatsapp.net/v/t61.24694-24/...",
    "wa_unreadCount": 44
  },
  "message": {
    "id": "556192894339:4AF07FA16B4843F9853D",
    "messageid": "4AF07FA16B4843F9853D",
    "chatid": "120363400460335306@g.us",
    "fromMe": false,
    "type": "text",
    "messageType": "Conversation",
    "text": "*EEG 21/02/2026 - Claudia*\n\n🧠 Paciente...",
    "content": "*EEG 21/02/2026 - Claudia*\n\n🧠 Paciente...",
    "sender": "88807777009685@lid",
    "sender_pn": "556191827054@s.whatsapp.net",
    "sender_lid": "88807777009685@lid",
    "senderName": "Claudia Santrib",
    "isGroup": true,
    "groupName": "CLAUDIA DOMINGO",
    "messageTimestamp": 1771712966000,
    "wasSentByApi": false
  }
}
```

#### Payload do webhook UAZAPI (evento de chamada):

```json
{
  "EventType": "call",
  "owner": "556192894339",
  "message": {
    "from": "5561999999999@s.whatsapp.net"
  },
  "chat": {
    "wa_chatid": "5561999999999@s.whatsapp.net"
  }
}
```

#### Mapeamento de campos UAZAPI → Banco:

| UAZAPI Payload | Campo no Banco | Notas |
|---|---|---|
| `chat.wa_chatid` | `conversas.wa_chatid` | Chave unica da conversa |
| `message.messageid` | `mensagens.wa_message_id` | Usar `messageid` (sem owner prefix) |
| `message.fromMe` | `mensagens.from_me` | Boolean |
| `message.text` | `mensagens.conteudo` | SEMPRE usar `.text` (string). `.content` pode ser objeto! |
| `message.type` | `mensagens.tipo_mensagem` | 'text', 'image', 'audio', etc. |
| `chat.name \|\| chat.wa_name` | `conversas.nome_contato` | `wa_contactName` geralmente vazio |
| `message.groupName \|\| chat.name` | `conversas.nome_grupo` | Para grupos |
| `chat.wa_isGroup` | `conversas.tipo` | true='grupo', false='individual' |
| `owner` | `conversas.categoria` | Via OWNER_CATEGORY_MAP |
| `chat.imagePreview` | `conversas.avatar_url` | Eh URL (nao base64!) |
| `message.senderName` | `mensagens.sender_name` | Pode estar vazio em individuais |
| `message.sender_pn` | `mensagens.sender_phone` | Usar `sender_pn`, NAO `sender` (que eh LID) |
| `chat.phone` | `conversas.telefone` | Em individual; vazio em grupo |
| `body.token` | validacao webhook | Comparar com WEBHOOK_SECRET |

### 360Dialog (WhatsApp — número Geral)

**Base URL**: `https://waba-v2.360dialog.io`
**Auth**: Header `D360-API-KEY: {{DIALOG360_API_KEY}}`

Payload do webhook segue o padrão **Meta Cloud API** (diferente da UAZAPI):

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5561999999999",
          "id": "wamid.xxx",
          "type": "text",
          "text": { "body": "Mensagem aqui" },
          "timestamp": "1234567890"
        }],
        "contacts": [{
          "profile": { "name": "João Silva" },
          "wa_id": "5561999999999"
        }]
      }
    }]
  }]
}
```

### Issabel/Asterisk AMI (Telefonia PABX)

**Host**: Servidor de produção (configurado em `AMI_HOST`)
**Port**: 5038 (TCP)
**Auth**: `AMI_USER` / `AMI_PASSWORD`

#### Eventos AMI relevantes:

| Evento | Significado | Ação |
|---|---|---|
| `Newchannel` | Chamada iniciou | INSERT status='ringing' |
| `DialBegin` | Ramal tocando | UPDATE ramal info |
| `BridgeEnter` | Atendeu | UPDATE status='answered' |
| `Hangup` | Desligou | UPDATE duracao_seg, fim_at |
| `VoicemailStart` | Voicemail | UPDATE status='voicemail' |

#### Identificação da origem:

```typescript
// Se contexto = 'from-whatsapp' → origem: 'whatsapp'
// Se contexto = 'from-external' → origem: 'telefone'
// Se CDR(accountcode) = 'whatsapp' → origem: 'whatsapp'
```

Biblioteca npm recomendada: `asterisk-manager`

---

## 🔄 SSE (Server-Sent Events)

O frontend recebe atualizações em tempo real via SSE em `/api/events`.

### Tipos de eventos:

```typescript
type SSEEvent =
  | { type: 'nova_mensagem'; data: { conversa_id: number; mensagem: Mensagem } }
  | { type: 'conversa_atualizada'; data: { conversa_id: number; ultima_msg: string; nao_lida: number } }
  | { type: 'chamada_nova'; data: { chamada: Chamada } }
  | { type: 'chamada_atualizada'; data: { chamada_id: number; status: string; duracao?: number } }
  | { type: 'ramal_status'; data: { ramal: string; status: 'online'|'offline'|'busy' } }
```

---

## 🖥️ Interface — Layout Fase 1

```
┌──────────────────────────────────────────────────────────────┐
│  🏥 Connect Schappo                            🔍 Buscar... │
├──────┬───────────────────────────────────────────────────────┤
│ NAV  │  ┌──────────┬────────────┬──────────┬────────────┐   │
│      │  │  Todos   │ Individual │ Grp EEG  │ Grp Recep  │   │
│ 💬   │  └──────────┴────────────┴──────────┴────────────┘   │
│ Chat │                                                       │
│      │  ┌─ CONVERSAS ────────────┬─ MENSAGENS ───────────┐  │
│ 📞   │  │ 🟢 João Silva   14:32 │ João: Boa tarde...     │  │
│ Calls│  │ 📞 Maria Lima   14:28 │ 🤖 Bot: Olá João!     │  │
│      │  │ 👥 Grupo EEG    14:15 │ João: Dia 15 está bom  │  │
│      │  │ ☎️ (61)9876...  13:50 │ ── 📞 Chamada ──       │  │
│      │  │ ⚠️ Ana Costa    13:30 │ João: Obrigado!        │  │
│      │  └────────────────────────┴───────────────────────┘  │
└──────┴───────────────────────────────────────────────────────┘
```

**Indicadores visuais:**
- 🟢 Mensagem nova (não lida)
- 📞 Chamada (com duração se atendida)
- ☎️ Ligação telefônica convencional
- 👥 Grupo (com badge EEG ou Recepção)
- ⚠️ Tentativa de chamada (auto-resposta enviada)
- 🤖 Mensagem do bot (fromMe)

---

## ⚙️ Variáveis de Ambiente (.env.local)

```env
# PostgreSQL
DATABASE_URL=postgresql://connect_dev:SENHA@localhost:5432/connect_schappo

# UAZAPI (números EEG + Recepção)
UAZAPI_URL=https://sua-instancia.uazapi.com
UAZAPI_TOKEN=seu_token_aqui

# 360Dialog (número Geral)
DIALOG360_API_URL=https://waba-v2.360dialog.io
DIALOG360_API_KEY=sua_api_key_aqui

# Mapeamento Owners → Categorias
OWNER_EEG=556192894339
OWNER_RECEPCAO=556183008973
OWNER_GERAL=556133455701

# Issabel/Asterisk AMI
AMI_HOST=IP_DO_SERVIDOR_ISSABEL
AMI_PORT=5038
AMI_USER=admin
AMI_PASSWORD=senha_ami

# Segurança
WEBHOOK_SECRET=token_validacao_webhook
PANEL_USER=admin
PANEL_PASS=senha_painel

# App
NEXT_PUBLIC_APP_URL=http://10.150.77.78:3000
NEXT_PUBLIC_APP_NAME=Connect Schappo
```

---

## 🐳 Deploy (Produção)

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.js ./
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
```

### docker-compose.yml (produção com Traefik)

```yaml
version: "3.8"
services:
  connect-schappo:
    build: .
    container_name: connect-schappo
    restart: unless-stopped
    env_file: .env
    environment:
      - NODE_ENV=production
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.connect.rule=Host(`connect.clinicaschappo.com`)"
      - "traefik.http.routers.connect.entrypoints=websecure"
      - "traefik.http.routers.connect.tls=true"
      - "traefik.http.routers.connect.tls.certresolver=letsencrypt"
      - "traefik.http.services.connect.loadbalancer.server.port=3000"
      - "traefik.http.middlewares.connect-sse.headers.customresponseheaders.Cache-Control=no-cache"
      - "traefik.http.middlewares.connect-sse.headers.customresponseheaders.X-Accel-Buffering=no"
      - "traefik.http.routers.connect.middlewares=connect-sse"
    networks:
      - traefik-public
      - internal
    extra_hosts:
      - "host.docker.internal:host-gateway"

networks:
  traefik-public:
    external: true
  internal:
    external: true
```

**Servidor de produção** usa **Traefik** como reverse proxy (não Nginx). TLS automático via Let's Encrypt.

**Servidor de desenvolvimento** (este): roda direto com `npm run dev` na porta 3000.

---

## 🔒 Segurança — Fase 1

### Autenticação do painel: HTTP Basic Auth via middleware Next.js

```typescript
// src/middleware.ts
// Webhooks (/api/webhook/*) passam sem auth do painel
// Demais rotas exigem Basic Auth (PANEL_USER + PANEL_PASS)
```

### Validação dos webhooks:

```typescript
// UAZAPI: validar header 'token' === WEBHOOK_SECRET
// 360Dialog: validar API key ou IP whitelist
```

### AMI: conexão local (127.0.0.1 ou host.docker.internal)
### PostgreSQL: conexão local, sem exposição externa

---

## 🧰 Stack Técnica

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | latest (App Router) | Framework web |
| React | 18+ | UI |
| TypeScript | 5+ | Tipagem |
| Tailwind CSS | 3+ | Estilização |
| PostgreSQL | 16 | Banco de dados |
| pg (node-postgres) | latest | Client PostgreSQL |
| asterisk-manager | latest | Client AMI (Issabel) |
| Docker | 29+ | Containerização |
| Traefik | latest | Reverse proxy (produção) |

---

## 📌 Convenções de Código

- **Idioma do código**: Inglês (nomes de variáveis, funções, tipos)
- **Idioma dos comentários**: Português
- **Idioma do banco**: Português (nomes de tabelas e colunas)
- **Idioma da interface**: Português (labels, textos, botões)
- **Framework CSS**: Tailwind (utility-first, sem CSS modules)
- **Estado do servidor**: React Server Components por padrão, Client Components apenas quando necessário (hooks, interatividade)
- **Fetch de dados**: Server Components com queries diretas ao banco (sem API intermediária para páginas)
- **API Routes**: Apenas para webhooks, SSE, e endpoints consumidos pelo frontend via hooks

---

## 🚨 Regras Importantes

1. **NUNCA alterar o fluxo do N8N** — O bot EEG continua funcionando independentemente via webhook #1 da UAZAPI
2. **Schema `atd` separado** — Todas as tabelas da plataforma ficam no schema `atd`, nunca no schema `public`
3. **Webhooks devem responder rápido** — Processar assincronamente se necessário, retornar 200 OK imediatamente
4. **SSE com reconexão** — Frontend deve reconectar automaticamente se conexão SSE cair
5. **Idempotência** — `wa_message_id` é UNIQUE, inserções duplicadas são ignoradas via ON CONFLICT
6. **Fase 1 é read-only** — Não implementar envio de mensagens ainda

---

## 🏥 Contexto do Negócio

A Clínica Schappo realiza exames de **EEG (eletroencefalograma)**. Técnicos como Renata, Paula, Jefferson e Claudia Santrib utilizam equipamento portátil (maletas C1-C16) para realizar exames em pacientes. O sistema de gestão de equipamentos (Neuro Schappo) já existe em N8N e não será afetado por este projeto.

A plataforma Connect Schappo resolve o problema de atendimento ao paciente — comunicação via WhatsApp e telefone — que hoje depende do Chatwoot (instável, lento, problemático com grupos).

**Grupos WhatsApp importantes:**
- Grupo EEG → técnicos discutem equipamentos e exames
- Grupo Recepção → recepcionistas coordenam agendamentos

---

## 🔗 Sistemas Relacionados (não alterar)

| Sistema | Função | Tecnologia |
|---|---|---|
| Neuro Schappo | Gestão de equipamentos EEG | N8N + PostgreSQL (schema: public) |
| Bot EEG | Automação WhatsApp | N8N (webhook #1 UAZAPI) |
| Chatwoot | Atendimento atual (será desligado na Fase 3) | Docker |
| Issabel PBX | Telefonia da clínica | Bare metal (Asterisk) |
| UAZAPI | API WhatsApp não-oficial | SaaS ou self-hosted |
| 360Dialog | API WhatsApp oficial (Cloud API) | SaaS |

---

## 📋 Checklist de Implementação — Fase 1

### 1A. Infraestrutura ✅ Em andamento
- [x] Setup servidor (Node.js, PostgreSQL, Docker, Git)
- [x] Criar projeto Next.js
- [x] Conectar ao GitHub
- [ ] Executar SQL do schema `atd`
- [ ] Criar `src/lib/db.ts` (pool PostgreSQL)
- [ ] Criar `src/lib/types.ts` (tipos TypeScript)
- [ ] Criar `/api/health/route.ts`

### 1B. Canal WhatsApp Mensagens
- [ ] Criar `src/lib/webhook-parser-uazapi.ts`
- [ ] Criar `src/lib/webhook-parser-360.ts`
- [ ] Criar `/api/webhook/uazapi/route.ts`
- [ ] Criar `/api/webhook/360dialog/route.ts`
- [ ] Criar `src/lib/sse-manager.ts`
- [ ] Criar `/api/events/route.ts` (SSE)
- [ ] Criar `/api/conversas/route.ts` (GET com filtros)
- [ ] Criar `/api/mensagens/[conversaId]/route.ts`
- [ ] Criar componentes: Sidebar, Header, ConversaList, ConversaItem
- [ ] Criar componentes: MessageView, MessageBubble, MediaPreview
- [ ] Criar componentes: CategoryFilter, SearchBar
- [ ] Criar hooks: useSSE, useConversas, useMensagens

### 1C. Canal Telefonia PABX
- [ ] Criar `src/lib/ami-listener.ts`
- [ ] Integrar AMI → atd.chamadas
- [ ] Integrar AMI → SSE
- [ ] Criar `/api/chamadas/route.ts`
- [ ] Criar componentes: CallLog, CallItem, CallAlert, RamalStatus

### 1D. Canal WhatsApp Voz
- [ ] Verificar tier no WhatsApp Manager
- [ ] Configurar PJSIP no Issabel
- [ ] Configurar dialplan `[from-whatsapp]`
- [ ] Habilitar Calling no 360Dialog
- [ ] Testar chamada inbound

### 1E. Auto-resposta (N8N)
- [ ] Alterar nó "Normalizar Payload" no WF-01
- [ ] Criar nó IF (isCallEvent)
- [ ] Criar nó HTTP Request (auto-resposta)

### Segurança
- [ ] Criar `src/middleware.ts` (Basic Auth)

### Deploy
- [ ] Criar Dockerfile
- [ ] Criar docker-compose.yml
- [ ] Configurar Traefik no servidor de produção
