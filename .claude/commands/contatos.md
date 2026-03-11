# Contatos
> Usar quando: lista contatos, import CSV, sync fotos, normalizacao telefone, participantes grupo

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/app/(app)/contatos/page.tsx` | Pagina contatos |
| `src/app/api/contatos/route.ts` | GET: lista unificada (UNION 3 fontes) |
| `src/app/api/contatos/add/route.ts` | POST: adicionar contato |
| `src/app/api/contatos/[id]/route.ts` | GET/PUT: detalhe/editar por telefone |
| `src/app/api/contatos/import-csv/route.ts` | POST: import CSV Chatwoot |
| `src/app/api/contatos/sync/route.ts` | POST: sync fotos UAZAPI |
| `src/app/api/participantes/[chatId]/route.ts` | GET: participantes grupo |
| `src/app/api/grupos/sync/route.ts` | POST: sync grupos WhatsApp |
| `src/components/contatos/ContatoList.tsx` | Lista infinite scroll |
| `src/components/contatos/ContatoItem.tsx` | Item contato |
| `src/components/contatos/ContatoDetailModal.tsx` | Modal detalhes/edicao |
| `src/components/contatos/AddContatoModal.tsx` | Modal novo contato |
| `src/components/contatos/ImportCsvModal.tsx` | Import CSV Chatwoot |
| `src/hooks/useContatos.ts` | Fetch + busca + sync |
| `src/lib/participant-cache.ts` | Cache participantes grupo |

---

## Lista Unificada

`/api/contatos` faz `UNION` de 3 fontes:
1. `atd.contatos` — contatos salvos manualmente
2. `atd.conversas` — contatos extraidos de conversas
3. `atd.participantes_grupo` — membros de grupos

---

## API Routes

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/contatos` | GET | Lista unificada com busca |
| `/api/contatos/add` | POST | Criar contato |
| `/api/contatos/[id]` | GET/PUT | Detalhe/editar por telefone |
| `/api/contatos/import-csv` | POST | Import CSV Chatwoot (batch upsert) |
| `/api/contatos/sync` | POST | Sync fotos UAZAPI |
| `/api/participantes/[chatId]` | GET | Participantes grupo (nomes, avatares, LID) |
| `/api/grupos/sync` | POST | Sync grupos WhatsApp via UAZAPI |

---

## Banco de Dados

### Tabela `atd.contatos`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| nome | TEXT | |
| telefone | TEXT UNIQUE | |
| email | TEXT | |
| notas | TEXT | |
| chatwoot_id | INTEGER | (migracao) |

### Tabela `atd.participantes_grupo`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| wa_phone | TEXT | UNIQUE com wa_chatid |
| wa_chatid | TEXT | |
| nome_whatsapp | TEXT | |
| avatar_url | TEXT | |

### Funcao `atd.normalize_phone()`

Normaliza telefone BR: 55 + DDD + 9o digito. Usada por triggers automaticos em INSERT/UPDATE.

---

## Regras

1. **Normalizacao automatica** — Triggers SQL normalizam telefone em insert/update
2. **Sync fotos** — Puxa foto de perfil via UAZAPI para contatos salvos
3. **Import CSV** — Formato Chatwoot, batch upsert com ON CONFLICT
4. **Participant cache** — Cache de nomes de participantes para mencoes em grupos
