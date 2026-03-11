# Chat Interno
> Usar quando: chat entre operadores, broadcast, popup, midia interna, reacoes internas

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/app/(app)/chat-interno/page.tsx` | Pagina chat interno (fullscreen mobile) |
| `src/app/api/chat-interno/route.ts` | GET: listar chats / POST: enviar msg |
| `src/app/api/chat-interno/[id]/mensagens/route.ts` | GET: mensagens paginadas |
| `src/app/api/chat-interno/[id]/media/route.ts` | GET: proxy midia |
| `src/app/api/chat-interno/[id]/react/route.ts` | POST: reagir emoji |
| `src/app/api/chat-interno/broadcast/route.ts` | POST: broadcast multiplos |
| `src/app/api/chat-interno/unread-count/route.ts` | GET: total nao-lidas |
| `src/components/chat-interno/ChatInternoList.tsx` | Lista sidebar |
| `src/components/chat-interno/ChatInternoView.tsx` | Thread mensagens |
| `src/components/chat-interno/ChatInternoMessage.tsx` | Balao mensagem |
| `src/components/chat-interno/ChatInternoPopup.tsx` | Popup flutuante |
| `src/components/chat-interno/OperatorList.tsx` | Seletor operador |
| `src/components/chat-interno/BroadcastModal.tsx` | Modal broadcast |
| `src/hooks/useChatInterno.ts` | Chat CRUD, mensagens, reacoes |

---

## Fluxo

- **Desktop**: Popup flutuante no AppShell (ChatInternoPopup)
- **Mobile**: Fullscreen (`fixed inset-0 z-[9999]`)
- Chats 1:1 com unique pair constraint (participante1_id, participante2_id)
- Broadcast: envia mesma mensagem para multiplos operadores

---

## API Routes

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/chat-interno` | GET | Listar chats com nao-lidas |
| `/api/chat-interno` | POST | Enviar mensagem (cria chat se nao existe) |
| `/api/chat-interno/[id]/mensagens` | GET | Mensagens paginadas (cursor) |
| `/api/chat-interno/[id]/media` | GET | Proxy midia interna |
| `/api/chat-interno/[id]/react` | POST | Reagir com emoji |
| `/api/chat-interno/broadcast` | POST | Broadcast multiplos operadores |
| `/api/chat-interno/unread-count` | GET | Total nao-lidas |

---

## Banco de Dados

### Tabela `atd.chat_interno`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| participante1_id | FK | → atendentes (UNIQUE pair) |
| participante2_id | FK | → atendentes (UNIQUE pair) |

### Tabela `atd.chat_interno_mensagens`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| chat_id | FK | → chat_interno |
| remetente_id | FK | → atendentes |
| conteudo | TEXT | |
| tipo | TEXT | texto, imagem, audio, etc |
| media_url | TEXT | |
| media_mimetype | TEXT | |
| media_filename | TEXT | |
| reacoes | JSONB | |
| reply_to_id | FK | → self (reply) |

---

## Regras

1. **Unique pair** — Chat 1:1 unico entre dois operadores
2. **Popup no AppShell** — Desktop: flutuante. Mobile: fullscreen z-[9999]
3. **Reacoes JSONB** — Armazenadas inline na mensagem

## SSE Events Relacionados

`chat_interno_mensagem`, `chat_interno_reacao` — ver skill `sse-realtime`
