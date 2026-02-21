Leia o arquivo CLAUDE.md na raiz do projeto para entender o contexto completo.

Execute a **Fase 1B — Canal WhatsApp Mensagens** do checklist:

1. Crie `src/lib/webhook-parser-uazapi.ts` — parser do payload UAZAPI (ver mapeamento no CLAUDE.md)
2. Crie `src/lib/webhook-parser-360.ts` — parser do payload 360Dialog (formato Meta Cloud API)
3. Crie `src/app/api/webhook/uazapi/route.ts` — recebe webhook, parseia, persiste no banco (atd.upsert_conversa + atd.registrar_mensagem), emite SSE
4. Crie `src/app/api/webhook/360dialog/route.ts` — mesmo fluxo para 360Dialog
5. Crie `src/lib/sse-manager.ts` — gerenciador de conexões SSE (singleton, broadcast)
6. Crie `src/app/api/events/route.ts` — endpoint SSE GET com reconexão
7. Crie `src/app/api/conversas/route.ts` — GET com filtros (categoria, tipo, busca)
8. Crie `src/app/api/mensagens/[conversaId]/route.ts` — GET mensagens paginadas
9. Crie os componentes de layout: `Sidebar.tsx`, `Header.tsx`
10. Crie os componentes de chat: `ConversaList.tsx`, `ConversaItem.tsx`, `MessageView.tsx`, `MessageBubble.tsx`, `MediaPreview.tsx`
11. Crie os componentes de filtro: `CategoryFilter.tsx`, `SearchBar.tsx`
12. Crie os hooks: `useSSE.ts`, `useConversas.ts`, `useMensagens.ts`
13. Monte as páginas: `src/app/page.tsx` (redirect), `src/app/conversas/page.tsx`, `src/app/conversas/[id]/page.tsx`
14. Teste com dados mockados se necessário
15. Commit e push

O layout deve seguir o mockup do CLAUDE.md. Use Tailwind. Responda em português.
