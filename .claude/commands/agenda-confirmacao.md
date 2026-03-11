# Agendamento e Confirmacao
> Usar quando: agendamentos, confirmacao via WhatsApp, templates Meta, integracao ERP Schappo, disparo em lote

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/app/(app)/confirmacao/page.tsx` | Pagina de confirmacao |
| `src/app/api/agenda/medicos/route.ts` | GET: medicos ativos |
| `src/app/api/agenda/agendamentos/route.ts` | GET: agendamentos por medico+data |
| `src/app/api/agenda/dias-atendimento/route.ts` | GET: dias disponiveis/ocupados |
| `src/app/api/agenda/paciente/route.ts` | GET: buscar paciente por telefone |
| `src/app/api/agenda/templates/route.ts` | GET/POST: templates confirmacao |
| `src/app/api/agenda/templates/[id]/route.ts` | PUT: editar template |
| `src/app/api/agenda/[chave]/status/route.ts` | PATCH: atualizar status confirmacao |
| `src/app/api/agenda/disparo/route.ts` | POST: disparo em lote |
| `src/app/api/mensagens/send-template/route.ts` | POST: enviar template Meta 360Dialog |
| `src/components/agenda/CalendarioMedico.tsx` | Calendario interativo |
| `src/components/chat/TemplateSendModal.tsx` | Modal template com preview |
| `src/hooks/useAgenda.ts` | Fluxo completo agenda |
| `src/lib/db-agenda.ts` | Pool externo ERP (LATIN1) |

---

## Fluxo

```
1. Selecionar medico (GET /api/agenda/medicos)
2. Selecionar data (CalendarioMedico + GET /api/agenda/dias-atendimento)
3. Listar agendamentos (GET /api/agenda/agendamentos)
4. Selecionar pacientes para confirmar
5. Disparo em lote (POST /api/agenda/disparo)
   ├── Para cada paciente:
   │   ├── 360Dialog: POST /api/mensagens/send-template (template Meta)
   │   └── UAZAPI: POST /api/mensagens/send (texto formatado)
   ├── Registrar em atd.confirmacao_agendamento
   └── Broadcast SSE (confirmacao_atualizada)
6. Paciente responde → webhook detecta resposta
   └── startsWith('1') = confirmado, startsWith('2') = desmarcou
```

---

## Banco ERP (LATIN1)

- **Host**: `AGENDA_DB_HOST:5432` | **DB**: `schappo` | **Encoding**: LATIN1
- Pool read-only (max 3 conexoes) via `lib/db-agenda.ts`
- **IMPORTANTE**: Usar `queryLatin1()` que converte campos LATIN1→UTF8 automaticamente
- Tabelas: `arq_agendal`, `arq_paciente`, `arq_medico`

---

## API Routes

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/agenda/medicos` | GET | Medicos ativos (banco externo) |
| `/api/agenda/agendamentos` | GET | Agendamentos por medico+data (LATIN1→UTF8) |
| `/api/agenda/dias-atendimento` | GET | Dias disponiveis/ocupados por medico+mes |
| `/api/agenda/paciente` | GET | Buscar paciente por telefone no ERP |
| `/api/agenda/templates` | GET/POST | Templates de mensagem confirmacao |
| `/api/agenda/templates/[id]` | PUT | Editar template (valida ownership) |
| `/api/agenda/[chave]/status` | PATCH | Atualizar status (confirmado/desmarcou/reagendar) |
| `/api/agenda/disparo` | POST | Disparo em lote (rate-limited + SSE) |
| `/api/mensagens/send-template` | POST | Template Meta via 360Dialog |

---

## Banco de Dados

### Tabela `atd.confirmacao_agendamento`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| chave_agenda | TEXT UNIQUE | Chave unica do agendamento |
| cod_paciente | INTEGER | Codigo no ERP |
| telefone_envio | TEXT | |
| wa_message_id | TEXT | |
| status | TEXT | 'enviado', 'confirmado', 'desmarcou', 'reagendar' |
| enviado_por | INTEGER | FK atendente |
| provider | TEXT | 'uazapi' ou '360dialog' |

### Tabela `atd.template_confirmacao`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| nome | TEXT | |
| conteudo | TEXT | Com placeholders |
| atendente_id | INTEGER | NULL = sistema |
| is_default | BOOLEAN | |

---

## Regras

1. **Deteccao de resposta flexivel** — `startsWith('1')` e `startsWith('2')` (nao match exato)
2. **queryLatin1()** — Obrigatorio para queries ao banco schappo ERP
3. **Disparo UAZAPI** — Apos enviar, registrar em `atd.conversas`/`atd.mensagens` + broadcast SSE
4. **Template Meta 5 params** — nome, data, hora, medico, procedimento
5. **Templates por operador** — `atendente_id NULL` = sistema, senao pertence ao operador

## SSE Events Relacionados

`confirmacao_atualizada` — ver skill `sse-realtime`
