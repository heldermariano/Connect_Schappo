# Respostas Prontas
> Usar quando: CRUD respostas, autocomplete /, atalhos por operador

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/app/api/respostas-prontas/route.ts` | GET: listar / POST: criar |
| `src/app/api/respostas-prontas/[id]/route.ts` | PUT: editar / DELETE: excluir |
| `src/app/(app)/respostas-prontas/page.tsx` | Pagina gerenciamento |
| `src/components/chat/QuickReplyAutocomplete.tsx` | Autocomplete no MessageInput |
| `src/components/respostas-prontas/RespostaProntaModal.tsx` | Modal criar/editar |
| `src/hooks/useRespostasProntas.ts` | CRUD hook |

---

## Fluxo

1. Operador digita `/` no MessageInput
2. `QuickReplyAutocomplete` abre popup posicionado `absolute bottom-full`
3. Respostas carregam lazy (1x no primeiro `/`, cacheadas em state)
4. Navegacao teclado: `document.addEventListener('keydown', ..., true)` (capture phase)
5. Selecionar insere conteudo no input

---

## API Routes

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/respostas-prontas` | GET | Lista do operador logado |
| `/api/respostas-prontas` | POST | Criar (atalho + conteudo) |
| `/api/respostas-prontas/[id]` | PUT | Editar (valida ownership) |
| `/api/respostas-prontas/[id]` | DELETE | Excluir (valida ownership) |

---

## Banco de Dados

### Tabela `atd.respostas_prontas`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| atendente_id | FK | → atendentes (individuais por operador) |
| atalho | TEXT | UNIQUE com atendente (case-insensitive) |
| conteudo | TEXT | |

Indice unico: `UNIQUE(atendente_id, LOWER(atalho))`

---

## Regras

1. **Individuais por operador** — Cada operador ve apenas suas respostas
2. **Lazy loading** — Carregam 1x no primeiro `/` digitado
3. **Capture phase** — Keyboard nav usa capture para interceptar antes do textarea
4. **Case-insensitive** — Atalho comparado em lowercase
