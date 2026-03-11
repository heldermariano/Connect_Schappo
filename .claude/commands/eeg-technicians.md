# EEG e Tecnicos
> Usar quando: exames EEG, hub tecnicos, validador fichas, busca #, download PDF, banco neuro_schappo

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/app/api/eeg/exames-tecnico/route.ts` | GET: exames do tecnico logado |
| `src/app/api/eeg/ficha/route.ts` | GET/POST: ficha de exame |
| `src/app/api/eeg/vincular-ficha/route.ts` | POST: vincular ficha a exame |
| `src/app/api/eeg/continuos-pendentes/route.ts` | GET: exames continuos pendentes |
| `src/app/api/exames/buscar/route.ts` | GET: busca exames (banco externo) |
| `src/app/api/exames/download/route.ts` | GET: proxy download PDF |
| `src/app/api/hub-usuarios/route.ts` | GET/POST: CRUD tecnicos |
| `src/app/api/hub-usuarios/[id]/route.ts` | PUT: editar tecnico |
| `src/app/api/ficha-validator/route.ts` | GET/POST: status/controle validador |
| `src/components/chat/ExameSearch.tsx` | Busca exames via # no MessageInput |
| `src/components/tecnicos/TecnicoModal.tsx` | Modal criar/editar tecnico |
| `src/hooks/useHubUsuarios.ts` | CRUD tecnicos |
| `src/lib/db-exames.ts` | Pool externo neuro_schappo |
| `src/lib/ficha-validator.ts` | Validador automatico fichas |
| `src/instrumentation.ts` | Inicia FichaValidator no boot |

---

## Banco Externo (NeuroSchappo)

- **Host**: `EXAMES_DB_HOST:5432` | **DB**: `neuro_schappo`
- Pool read-only (max 5 conexoes) via `lib/db-exames.ts`
- Busca por nome de paciente retorna exames com links para laudo/tracado PDF

---

## API Routes

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/eeg/exames-tecnico` | GET | Exames do tecnico logado |
| `/api/eeg/ficha` | GET/POST | Ficha de exame EEG |
| `/api/eeg/vincular-ficha` | POST | Vincular ficha a exame |
| `/api/eeg/continuos-pendentes` | GET | Exames continuos pendentes |
| `/api/exames/buscar` | GET | Busca exames por nome (neuro_schappo) |
| `/api/exames/download` | GET | Proxy download PDF (validacao URL) |
| `/api/hub-usuarios` | GET/POST | Lista/criar tecnicos (admin/supervisor) |
| `/api/hub-usuarios/[id]` | PUT | Editar tecnico |
| `/api/ficha-validator` | GET | Status validador (running, stats) |
| `/api/ficha-validator` | POST | Iniciar/parar (action: start/stop) |

---

## Busca via # (ExameSearch)

No MessageInput, digitar `#` abre popup de busca de exames. Resultados do banco neuro_schappo com opcao de download/envio de laudos e tracados PDF.

---

## Validador de Fichas

- `ficha-validator.ts`: polling periodico que verifica fichas EEG incompletas
- Envia alertas WhatsApp para tecnicos com campos faltantes
- Iniciado automaticamente via `instrumentation.ts` no boot do Next.js
- Admin pode start/stop via `/api/ficha-validator`

---

## Banco de Dados

### Tabela `atd.hub_usuarios`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| nome | TEXT | |
| telefone | TEXT UNIQUE | |
| cargo | TEXT | |
| setor | TEXT | |
| ativo | BOOLEAN | |

### Tabela `atd.eeg_alertas_ficha`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| exam_id | INTEGER UNIQUE | |
| tecnico_id | FK | → hub_usuarios |
| campos_faltantes | TEXT[] | |
| corrigido | BOOLEAN | |
| paciente_nome | TEXT | |
| data_exame | DATE | |

### Tabela `atd.eeg_exame_ficha_vinculo`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| exam_id | INTEGER | |
| ficha_id | INTEGER | |

---

## Regras

1. **Hub tecnicos** — Somente admin/supervisor pode gerenciar
2. **Busca #** — Autocomplete posicionado `absolute bottom-full` no MessageInput
3. **Download PDF** — Proxy com validacao de URL (nao expor URLs internas)
4. **NUNCA alterar fluxo N8N** — Bot EEG funciona independente via webhook #1
