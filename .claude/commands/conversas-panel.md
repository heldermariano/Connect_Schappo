# Painel de Conversas
> Usar quando: lista de conversas, filtros, busca, atribuicao, arquivamento, header do contato, pendentes

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/app/(app)/conversas/page.tsx` | Pagina principal (lista + mensagens) |
| `src/app/(app)/conversas/[id]/page.tsx` | Redirect → /conversas |
| `src/app/api/conversas/route.ts` | GET: lista com filtros + JOIN contatos |
| `src/app/api/conversas/create/route.ts` | POST: criar/retornar conversa por telefone |
| `src/app/api/conversas/por-telefone/route.ts` | GET: conversas individuais por telefone |
| `src/app/api/conversas/unread-counts/route.ts` | GET: contagem nao-lidas por categoria |
| `src/app/api/conversas/[id]/read/route.ts` | PATCH: marcar como lida |
| `src/app/api/conversas/[id]/atribuir/route.ts` | PATCH: atribuir atendente / finalizar |
| `src/components/chat/ConversaList.tsx` | Lista de conversas |
| `src/components/chat/ConversaItem.tsx` | Item (avatar, nome, preview, badge) |
| `src/components/chat/ConversaContextMenu.tsx` | Menu contexto na lista |
| `src/components/chat/MessageView.tsx` | Area de mensagens + header contato |
| `src/components/chat/MessageInput.tsx` | Input texto + attachments (16MB max) |
| `src/components/chat/PacienteBanner.tsx` | Banner info paciente (busca ERP) |
| `src/components/chat/WaitTimer.tsx` | Timer tempo de espera |
| `src/components/chat/AtribuirDropdown.tsx` | Dropdown atribuir atendente |
| `src/components/chat/GrupoListModal.tsx` | Modal sync grupos UAZAPI |
| `src/components/filters/CategoryFilter.tsx` | 2 tabs + busca + pendentes |
| `src/hooks/useConversas.ts` | Fetch + filtro conversas |

---

## Fluxo do Painel

```
CategoryFilter (2 tabs: Individual | Grupo)
  ├── Busca inline (nome/telefone)
  ├── Icone pendentes (sino) → filtra pendentes-individual/pendentes-grupo
  └── Icone listar grupos → GrupoListModal (sync UAZAPI)

ConversaList → ConversaItem (avatar, nome, preview, badge nao-lida)
  └── Click → MessageView (header + mensagens + input)
       ├── PacienteBanner (lookup ERP por telefone)
       ├── WaitTimer (tempo espera paciente)
       ├── AtribuirDropdown
       └── MessageInput (texto + # exames + @ mencoes + / respostas)
```

---

## API Routes

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/conversas` | GET | Lista com filtros (categoria, tipo, busca profunda, grupo_atendimento) |
| `/api/conversas/create` | POST | Criar/retornar conversa por telefone |
| `/api/conversas/por-telefone` | GET | Conversas individuais por telefone (seletor canal) |
| `/api/conversas/unread-counts` | GET | Contagem nao-lidas por categoria (grupo-aware) |
| `/api/conversas/[id]/read` | PATCH | Marcar como lida (nao_lida = FALSE) |
| `/api/conversas/[id]/atribuir` | PATCH | Atribuir atendente / finalizar (is_archived) |
| `/api/conversas/[id]` | DELETE | Excluir conversa (admin only) |

### Busca Profunda

`/api/conversas?busca=texto` busca em: nome, telefone E conteudo de mensagens (subquery `LIMIT 50`, minimo 3 chars). `buscaPainel` (busca no painel) eh separado de `busca` (busca contatos no Header).

---

## Banco de Dados

### Tabela `atd.conversas`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| wa_chatid | TEXT UNIQUE | ID do chat WhatsApp |
| tipo | TEXT | 'individual' ou 'grupo' |
| categoria | TEXT | 'eeg', 'recepcao', 'geral' |
| provider | TEXT | 'uazapi' ou '360dialog' |
| telefone | TEXT | Numero (individual) |
| nome_contato | TEXT | |
| nome_grupo | TEXT | (para grupos) |
| avatar_url | TEXT | |
| nao_lida | BOOLEAN | |
| atendente_id | FK | Atendente atribuido |
| is_archived | BOOLEAN | Finalizado (oculta da lista) |
| ultima_msg | TEXT | Preview ultima mensagem |
| ultima_msg_at | TIMESTAMPTZ | |
| ultima_msg_from_me | BOOLEAN | |

### Funcao `atd.upsert_conversa()`
Insert/update conversa por wa_chatid. Usado pelos webhook parsers.

---

## Regras

1. **Finalizar = arquivar** — `is_archived = TRUE` oculta da lista; webhook reseta para `FALSE` com nova msg
2. **Pendentes** — Valor composto `pendentes-individual`/`pendentes-grupo` para filtrar por tipo
3. **GrupoListModal** — Sync via `POST /api/grupos/sync` (que usa `POST /group/list` UAZAPI com `{ force: true, noParticipants: true, pageSize: 1000 }`)
4. **Grupo de atendimento** — Filtra conversas pela categoria do operador logado

## SSE Events Relacionados

`conversa_atualizada` — ver skill `sse-realtime`
