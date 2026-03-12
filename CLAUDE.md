# CLAUDE.md — Connect Schappo

> Plataforma de atendimento unificada para a Clinica Schappo (EEG em Brasilia). Unifica WhatsApp + Telefonia PABX em um unico painel web.

| Info | Valor |
|------|-------|
| Producao | https://connect.clinicaschappo.com |
| Dev server | http://10.150.77.78:3000 |
| Repositorio | https://github.com/heldermariano/Connect_Schappo |

---

## Stack

| Tecnologia | Versao | Uso |
|---|---|---|
| Next.js | 16.1.6 | Framework (App Router + Turbopack) |
| React | 19.2.3 | UI |
| TypeScript | 5.x (strict) | Tipagem |
| Tailwind CSS | 4.x | Estilos |
| PostgreSQL | 16 | Banco (schema: `atd`) |
| pg | 8.18.0 | Client PostgreSQL |
| Redis | 7 | Cache e SSE pub/sub (via ioredis) |
| ioredis | 5.x | Client Redis |
| NextAuth | 4.24.13 | Autenticacao JWT |
| sip.js | 0.21.2 | Softphone WebRTC |
| ffmpeg-static | 5.3.0 | Conversao audio webm→ogg |
| Docker + Traefik | latest | Deploy producao |
| Capacitor | 8.x | App mobile via URL remota |

---

## Estrutura de Diretorios

```
connect-schappo/
├── CLAUDE.md
├── package.json
├── capacitor.config.ts          # Capacitor: URL remota
├── Dockerfile / docker-compose.yml
├── docker-compose.test.yml      # Ambiente de teste (:3001)
├── sql/                         # Migracoes 001-021
├── config/                      # PJSIP, extensions, N8N
├── docs/                        # Guias deploy, PJSIP, payload UAZAPI
├── public/                      # Favicon, manifest, sons
└── src/
    ├── middleware.ts             # Auth JWT + Security Headers
    ├── instrumentation.ts       # Boot: FichaValidator
    ├── app/
    │   ├── layout.tsx / globals.css
    │   ├── login/page.tsx
    │   ├── (app)/               # Route group autenticado
    │   │   ├── conversas/       # Painel principal
    │   │   ├── chamadas/        # Log chamadas
    │   │   ├── contatos/        # Lista contatos
    │   │   ├── confirmacao/     # Agendamento
    │   │   ├── supervisao/      # Dashboard
    │   │   ├── chat-interno/    # Chat operadores
    │   │   ├── tecnicos/        # Hub tecnicos EEG
    │   │   └── respostas-prontas/
    │   └── api/                 # ~40 routes (webhooks, CRUD, SSE)
    ├── components/              # chat/, softphone/, layout/, contatos/, etc.
    ├── hooks/                   # useSSE, useConversas, useSipPhone, etc.
    ├── contexts/AppContext.tsx   # isMobile, operatorStatus
    ├── lib/                     # db pools (read/write), redis, SSE manager, AMI
    └── types/
```

---

## Convencoes Cross-Cutting

### Codigo e Estilo
- **Codigo**: ingles | **Comentarios/UI/Banco**: portugues
- **CSS**: Tailwind utility-first (sem CSS modules)
- **Client Components** (`'use client'`) para interatividade, Server Components para layout

### Banco de Dados
- **Schema `atd` sempre** — Nunca usar schema `public`
- **Timezone `America/Sao_Paulo`** — Todas as camadas (Node, PG, Docker)
- **TIMESTAMPTZ** — Nunca usar TIMESTAMP sem timezone
- **Idempotencia** — `wa_message_id` UNIQUE, `ON CONFLICT DO NOTHING`
- **Soft-delete** — `is_deleted + deleted_at + deleted_by` em mensagens
- **Pools separados** — `pool` (default, escrita via `connect_write`) e `poolRead` (leitura via `connect_read`)
  - Rotas GET-only: usar `import { poolRead } from '@/lib/db'`
  - Rotas com escrita: usar `import pool from '@/lib/db'` (default)
  - Rotas mistas (GET+POST): importar ambos, usar `poolRead` no GET e `pool` no POST
- **Sem credenciais hardcoded** — Todas as conexoes via variaveis de ambiente, sem defaults

### Redis
- **SSE pub/sub** — `src/lib/sse-manager.ts` publica eventos via Redis para multi-instancia
- **Fallback local** — Se Redis indisponivel, SSE usa broadcast local (Map<>)
- **Import**: `import redis from '@/lib/redis'` ou `import { createSubscriber } from '@/lib/redis'`

### Security Headers
- Middleware injeta headers em todas as respostas: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection, HSTS
- **Permissions-Policy**: `microphone=(self)` obrigatorio para Softphone WebRTC
- **Sem CSP restritivo** por ora — inline scripts do Next.js exigem `nonce` (iteracao futura)

### Auth
- `session.user.id` eh **string** — Usar `parseInt(session.user.id as string)`
- `session.user.grupo` — Cast: `(session.user as { grupo?: string }).grupo`
- Pattern: `getServerSession(authOptions)` + check `!session?.user`

### Layout / Mobile
- **Breakpoint 768px** (`md:` Tailwind) — `isMobile` via `useAppContext()`
- **Softphone**: `dynamic()` com `ssr: false` (sip.js usa APIs browser)
- **overflow-hidden** no root + `min-w-0` nos filhos

### Webhooks
- Retornar **200 OK imediato**, processar async
- **NUNCA alterar fluxo N8N** — Bot EEG independente via webhook #1

### Build / Producao
- **Source maps desabilitados** no browser (`productionBrowserSourceMaps: false`)
- **console.log removido** em producao (mantém `console.error` e `console.warn`)
- **Docker**: Redis como servico separado no `docker-compose.yml` (depends_on com healthcheck)
- **Docker networking**: duas redes — `traefik_default` (Traefik) + `internal` (Redis). Label `traefik.docker.network=traefik_default` obrigatorio
- **Teste**: `docker-compose.test.yml` sobe ambiente isolado na porta 3001

---

## Skills por Dominio

Cada skill contem arquivos, APIs, banco, regras e gotchas do seu dominio. Usar `/nome-da-skill` para carregar.

| Skill | Quando usar |
|-------|-------------|
| `/whatsapp-messaging` | Enviar/receber mensagens, midia, audio, templates, webhooks |
| `/conversas-panel` | Lista conversas, filtros, busca, atribuicao, arquivamento |
| `/softphone-telephony` | Softphone, SIP/WebRTC, DTMF, ramais, chamadas, AMI |
| `/agenda-confirmacao` | Agendamentos, confirmacao WhatsApp, templates, ERP |
| `/eeg-technicians` | Exames EEG, hub tecnicos, validador fichas, busca # |
| `/chat-interno` | Chat entre operadores, broadcast, popup |
| `/contatos` | Lista contatos, import CSV, sync fotos, normalizacao telefone |
| `/layout-mobile` | AppShell, Sidebar, BottomNav, responsivo, Capacitor |
| `/auth-permissions` | Login, roles, presenca, sessao, middleware |
| `/database-infra` | Schema SQL, migracoes, pools, Docker, deploy |
| `/quick-replies` | Respostas prontas, autocomplete /, atalhos |
| `/supervisao` | Dashboard metricas, SLA, pausas |
| `/sse-realtime` | SSE stream, broadcast, tipos de evento |

---

## Variaveis de Ambiente

```env
# PostgreSQL — pools separados read/write
DATABASE_URL=postgresql://connect_write:SENHA@localhost:5432/connect_schappo
DATABASE_READ_URL=postgresql://connect_read:SENHA@localhost:5432/connect_schappo
# UAZAPI
UAZAPI_URL=https://schappo.uazapi.com
UAZAPI_TOKEN=token_default
UAZAPI_INSTANCE_TOKENS=token1,token2
# 360Dialog
DIALOG360_API_URL=https://waba-v2.360dialog.io
DIALOG360_API_KEY=chave_api
# Owners
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
NEXTAUTH_SECRET=jwt_secret
NEXTAUTH_URL=https://connect.clinicaschappo.com
# Banco Exames (Neuro Schappo — somente leitura)
EXAMES_DB_HOST=10.150.77.77
EXAMES_DB_PORT=5432
EXAMES_DB_NAME=neuro_schappo
EXAMES_DB_USER=neuro_schappo
EXAMES_DB_PASSWORD=senha
# Banco Agenda/ERP Konsyst (obrigatorio, sem defaults)
AGENDA_DB_HOST=ip_servidor
AGENDA_DB_PORT=5432
AGENDA_DB_NAME=schappo
AGENDA_DB_USER=usuario
AGENDA_DB_PASSWORD=senha
# Redis (SSE pub/sub, cache)
REDIS_URL=redis://localhost:6379
# Geral
TZ=America/Sao_Paulo
NEXT_PUBLIC_APP_URL=http://10.150.77.78:3000
NEXT_PUBLIC_APP_NAME=Connect Schappo
```

---

## Contexto do Negocio

Clinica Schappo realiza exames EEG (eletroencefalograma) em Brasilia. Tecnicos usam maletas portateis. Comunicacao via WhatsApp (3 numeros: EEG, Recepcao, Geral) e telefone PABX (Issabel). App mobile (Capacitor) para tecnicos em campo.

**Sistemas externos** (nao alterar): Neuro Schappo (gestao EEG), Bot EEG (N8N), Issabel PBX (Asterisk).
