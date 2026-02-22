# Connect Schappo — Status do Projeto

> Ultima atualizacao: 22/02/2026

---

## Resumo Geral

O Connect Schappo e uma plataforma de atendimento unificada para a Clinica Schappo.
A Fase 1 (read-only) esta completa. A Fase 2 (interacao) esta parcialmente implementada.

---

## O Que Ja Foi Implementado

### Infraestrutura
- [x] Projeto Next.js 16 + TypeScript + Tailwind CSS 4
- [x] PostgreSQL schema `atd` com 6 tabelas + 2 funcoes PL/pgSQL
- [x] Docker multi-stage build + docker-compose com Traefik
- [x] Deploy em producao: connect.clinicaschappo.com (HTTPS auto)
- [x] Health check `/api/health` (DB + AMI)

### Autenticacao e Seguranca
- [x] NextAuth com CredentialsProvider (username/password bcrypt)
- [x] JWT strategy (12h expiracao)
- [x] Middleware protegendo todas as rotas (exceto webhooks/auth/static)
- [x] Controle de acesso por grupo de atendimento (eeg/recepcao/geral/todos)
- [x] Validacao de token nos webhooks

### Canal WhatsApp Mensagens
- [x] Webhook UAZAPI — recebe mensagens individuais e de grupo
- [x] Webhook 360Dialog — recebe mensagens (Meta Cloud API format)
- [x] Parser de payload para ambos providers
- [x] Upsert de conversas e registro de mensagens (idempotente)
- [x] SSE (Server-Sent Events) para atualizacoes em tempo real
- [x] Frontend: lista conversas, filtros (categoria/tipo/busca), mensagens
- [x] Avatares de contato e participantes de grupo
- [x] Deteccao de mencoes (@) com notificacao sonora e toast

### Canal Telefonia PABX
- [x] AMI listener para Issabel/Asterisk (Newchannel → Hangup)
- [x] Log de chamadas com filtros (origem, status, atendente)
- [x] Status de ramais em tempo real via SSE
- [x] Alerta visual de chamada ativa
- [x] Click-to-call via AMI (`/api/calls/originate`)

### Canal WhatsApp Voz (Configuracao)
- [x] Documentacao PJSIP + dialplan para trunk SIP 360Dialog
- [x] Config files em `/config/` (pjsip, extensions, firewall, certbot)

### Softphone WebRTC
- [x] Integracao SIP.js 0.21.2 com Issabel
- [x] Registro SIP, chamadas de entrada e saida
- [x] Controles: mute, hold, DTMF
- [x] Teclado numerico (DialPad)
- [x] Config SIP por atendente (senha encriptada AES-256-GCM)
- [x] Visivel em todas as paginas (layout compartilhado)
- [x] Click-to-call a partir de conversas e contatos

### Envio de Mensagens
- [x] Envio de texto via UAZAPI e 360Dialog
- [x] Envio de midia (imagem, audio, video, documento)
- [x] Permissoes por categoria do operador
- [x] Preview de anexo antes de enviar (16MB max)

### Contatos
- [x] Lista unificada (conversas + participantes_grupo + contatos salvos)
- [x] Busca por nome, telefone, email
- [x] Import CSV do Chatwoot (batch upsert)
- [x] Adicionar contato manualmente
- [x] Modal detalhes/edicao (nome, email, notas)
- [x] Sync de fotos via UAZAPI
- [x] Busca no header encontra contatos salvos (LEFT JOIN)

### UX / Interface
- [x] Layout compartilhado: Sidebar + Softphone em todas as telas
- [x] Lightbox fullscreen para imagens
- [x] Media proxy com streaming (PDFs inline, docs download)
- [x] Retry automatico para URLs de midia expiradas
- [x] Fallback visual para imagens indisponiveis
- [x] Atribuicao de conversas a atendentes
- [x] Status de presenca (disponivel/pausa/ausente/offline)
- [x] Tela de login com branding da clinica

---

## O Que Falta Implementar

### Prioridade Alta
- [ ] Dashboard de metricas (tempo resposta, volume, SLA)
- [ ] Respostas rapidas (templates)
- [ ] Notas internas em conversas
- [ ] Tags/labels nas conversas (UI para gerenciar)

### Prioridade Media
- [ ] Fila de atendimento inteligente (distribuicao automatica)
- [ ] Historico unificado por contato (timeline cross-channel)
- [ ] Player inline para gravacoes de chamadas
- [ ] Transferencia de conversa entre atendentes
- [ ] Notificacoes push (service worker)

### Prioridade Baixa
- [ ] Campanhas de mensagens em massa
- [ ] Relatorios exportaveis (CSV/PDF)
- [ ] Integracao calendario (agendamentos)
- [ ] API publica para integracoes externas
- [ ] App mobile (PWA)

---

## Mapa de Documentacao

| Documento | Path | Conteudo |
|-----------|------|----------|
| CLAUDE.md | `/CLAUDE.md` | Referencia principal — arquitetura, estrutura, APIs, convencoes |
| Status do Projeto | `/docs/STATUS_PROJETO.md` | Este arquivo — o que esta feito e o que falta |
| Correcao Payload UAZAPI | `/docs/CORRECAO_PAYLOAD_UAZAPI.md` | Mapeamento real de campos UAZAPI |
| Deploy Producao | `/docs/GUIA_DEPLOY_PRODUCAO.md` | Docker + Traefik + procedimentos |
| WhatsApp Voz | `/docs/GUIA_DEPLOY_WHATSAPP_VOZ.md` | SIP + Asterisk + 360Dialog Calling |
| Auto-resposta N8N | `/docs/GUIA_AUTORESPOSTA_N8N.md` | Workflow N8N para auto-reply chamadas |
| Melhorias Fase 2 | `/docs/MELHORIAS_FASE2.md` | Roadmap original (parcialmente feito) |

### Migracoes SQL

| Arquivo | Conteudo |
|---------|----------|
| `sql/001_schema_atd.sql` | Schema base + tabelas + funcoes PL/pgSQL |
| `sql/002_auth_atendentes.sql` | Campos auth (username, password_hash, grupo) |
| `sql/003_participantes_grupo.sql` | Tabela participantes_grupo |
| `sql/004_mencoes_registrar_mensagem.sql` | Campo mencoes[] |
| `sql/005_contatos_table.sql` | Tabela contatos |
| `sql/006_softphone_sip_settings.sql` | Campos SIP em atendentes |

### Configs Externos

| Arquivo | Conteudo |
|---------|----------|
| `config/pjsip-whatsapp.conf` | PJSIP trunk 360Dialog |
| `config/extensions-whatsapp.conf` | Dialplan Asterisk |
| `config/360dialog-calling-settings.json` | Config Calling API |
| `config/n8n-call-autoreply.json` | Workflow N8N |
| `config/firewall-rules.sh` | Regras UFW (SIP/RTP/AMI) |

---

## Historico de Commits (resumido)

| Commit | Descricao |
|--------|-----------|
| `e5d9f52` | fix: page-not-loading + media error handling |
| `c991a03` | feat: UX improvements — media streaming, lightbox, shared layout, contact modal, search, media input |
| `8ca30c3` | fix: softphone visivel, paginacao contatos, validacao webhook |
| `c856226` | feat: softphone WebRTC + contatos com import CSV |
| `cb635df` | feat: contatos, sync fotos UAZAPI, mini-avatar grupos |
| `ef998e4` | feat: WhatsApp voz configs (SIP/Asterisk) |
| `e04cc27` | feat: auto-resposta N8N (docs) |
| `5b3ace2` | feat: telefonia PABX (AMI + chamadas) |
| `398542a` | feat: WhatsApp mensagens (webhooks + SSE + UI) |
| `4dfce17` | feat: infraestrutura base |
| `b1edfd7` | initial: Next.js setup |

---

## Contagem de Arquivos

| Diretorio | Quantidade | Tipo |
|-----------|------------|------|
| `src/app/api/` | 21 route.ts | API Routes |
| `src/components/` | 35 .tsx | React Components |
| `src/hooks/` | 6 .ts | Custom Hooks |
| `src/lib/` | 10 .ts | Utilities |
| `src/contexts/` | 1 .tsx | React Context |
| `sql/` | 6 .sql | Migracoes |
| `config/` | 7 arquivos | Configs externos |
| `docs/` | 6 .md | Documentacao |
