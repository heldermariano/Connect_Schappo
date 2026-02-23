# Melhoria 9: Busca de Resultados de Exames via #

> Status: DONE — Implementado em 23/02/2026

---

## Conceito

Atendente digita `#nome-do-paciente` no input de mensagem e o sistema busca no banco PostgreSQL externo (NeuroSchappo) o exame mais recente daquele paciente. Se encontrar, permite baixar os PDFs (laudo + tracado) e anexar na mensagem para enviar ao paciente via WhatsApp.

---

## Fluxo Implementado

```
1. Paciente envia: "Oi, gostaria do resultado do meu exame"

2. Atendente digita no input: #Barbara Queiroz

3. Sistema busca no banco externo (neuro_schappo em 10.150.77.77)
   - Apenas o ULTIMO exame por paciente (DISTINCT ON p.id, ORDER BY exam_date DESC)
   - Busca por name_normalized (LIKE case-insensitive)

4. Popup aparece acima do input com resultados:
   ┌─────────────────────────────────────────────────┐
   │ Exames de "Barbara Queiroz"                   X │
   ├─────────────────────────────────────────────────┤
   │ Barbara Queiroz Ignowsky                        │
   │ EEG · 21/02/2026 · Laudo Entregue              │
   │ EEG - Barbara Queiroz 21.02.26.pdf             │
   │ Tracado - Barbara Queiroz 21.02.26.pdf          │
   │                              [Laudo + Tracado]  │
   └─────────────────────────────────────────────────┘

5. Atendente clica "Laudo + Tracado":
   - Sistema baixa TODOS os PDFs via proxy /api/exames/download
   - Arquivos aparecem como attachments no input de mensagem
   - Nomes originais dos arquivos sao preservados

6. Atendente clica enviar → PDFs vao para o WhatsApp do paciente
   - Cada arquivo enviado sequencialmente
   - Nome do arquivo aparece como titulo no WhatsApp
```

---

## Arquitetura

### Banco Externo (NeuroSchappo)

- **Host**: 10.150.77.77
- **Banco**: neuro_schappo
- **Pool**: `src/lib/db-exames.ts` (max 5 conexoes, read-only)

### Tabelas consultadas

| Tabela | Colunas relevantes |
|--------|-------------------|
| `patients` | id, name, name_normalized |
| `exams` | id, patient_id, exam_type, exam_date, status, location_code |
| `reports` | id, exam_id, report_type, filename, download_url, matched |
| `clinical_reports` | id, exam_id, status (delivered/signed/reported/in_progress) |

### Query Principal (CTE)

```sql
WITH latest_exams AS (
  SELECT DISTINCT ON (p.id)
    p.id AS patient_id, p.name AS paciente,
    e.id AS exam_id, e.exam_type, e.exam_date, e.status, e.location_code
  FROM patients p
  JOIN exams e ON e.patient_id = p.id
  WHERE LOWER(p.name_normalized) LIKE LOWER('%' || $1 || '%')
  ORDER BY p.id, e.exam_date DESC
)
SELECT ...
FROM latest_exams le
LEFT JOIN clinical_reports cr ON cr.exam_id = le.exam_id
LEFT JOIN reports r ON r.exam_id = le.exam_id
  AND r.matched = true
  AND r.report_type IN ('laudo', 'tracado', 'laudo_tracado')
  AND r.download_url IS NOT NULL
```

### Download de PDFs

- `reports.download_url` contem URLs com token HMAC:
  `http://eeg.clinicaschappo.com/api/reports/{id}/download?token={hmac}`
- Proxy `/api/exames/download` evita CORS e redireciona para IP interno:
  `http://10.150.77.77:3000/api/reports/{id}/download?token={hmac}`
- Validacao: apenas URLs de `eeg.clinicaschappo.com` ou `10.150.77.77`

---

## Arquivos

| Arquivo | Funcao |
|---------|--------|
| `src/lib/db-exames.ts` | Pool PostgreSQL externo (neuro_schappo) |
| `src/app/api/exames/buscar/route.ts` | GET: busca exames por nome, retorna ultimo por paciente |
| `src/app/api/exames/download/route.ts` | GET: proxy download PDF (valida URL, reescreve para IP interno) |
| `src/components/chat/ExameSearch.tsx` | Popup de resultados com botao download unificado |
| `src/components/chat/MessageInput.tsx` | Suporte a multiplos attachments (File[]) |

---

## Variaveis de Ambiente

```env
EXAMES_DB_HOST=10.150.77.77
EXAMES_DB_PORT=5432
EXAMES_DB_NAME=neuro_schappo
EXAMES_DB_USER=neuro_schappo
EXAMES_DB_PASSWORD=senha
```

---

## Permissoes

- Grupos permitidos: `recepcao`, `eeg`, `todos`
- Acesso somente leitura ao banco externo

---

## Status de Exames (mapeamento)

| Valor BD | Label no Frontend | Cor |
|----------|-------------------|-----|
| clinical_reports.status = 'delivered' | Laudo Entregue | verde |
| clinical_reports.status = 'signed' | Laudo Assinado | verde claro |
| clinical_reports.status = 'reported'/'in_progress' | Em Laudo | amarelo |
| exams.status = 'delivered' | Realizado | azul |
| (outros) | Registrado | cinza |

---

*Implementado em: 23/02/2026*
*Commits: a62be31, bdf8a5c, f12ca05, 69173ff, 895caa4, db9d606*
