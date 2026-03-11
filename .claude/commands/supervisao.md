# Supervisao
> Usar quando: dashboard metricas, SLA, pausas, inatividade, status operadores

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/app/(app)/supervisao/page.tsx` | Dashboard supervisao |
| `src/app/api/supervisao/route.ts` | GET: metricas supervisor |
| `src/app/api/supervisao/me/route.ts` | GET: metricas operador logado |

---

## API Routes

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/supervisao` | GET | Metricas: pendentes, SLA, status operadores, historico pausas |
| `/api/supervisao/me` | GET | Metricas do operador logado (inatividade, pendentes) |

---

## Metricas

- **Pendentes**: conversas nao-lidas sem atendente
- **SLA**: tempo medio de primeira resposta
- **Status operadores**: presenca atual de todos
- **Historico pausas**: duracao e frequencia por operador

---

## Banco de Dados

Consulta cruzada de:
- `atd.conversas` — pendentes, atribuicoes
- `atd.atendentes` — status presenca
- `atd.atendente_pausas` — historico de pausas

---

## Regras

1. **Admin only** — Dashboard completo somente para admin/supervisor
2. **`/me`** — Operador logado pode ver suas proprias metricas
