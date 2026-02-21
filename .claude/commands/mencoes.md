Leia `CLAUDE.md` e `docs/MELHORIAS_FASE2.md` (seção "Melhoria 8: Menções em Grupos").

Execute:

1. Atualize `webhook-parser-uazapi.ts` — extrair campo `mentionedJid` do payload → salvar em `atd.mensagens.mencoes` (array de phones)
2. Atualize `MessageBubble.tsx`:
   - Detectar padrão @NUMERO ou @NOME no texto
   - Renderizar menções em **negrito laranja** (text-schappo-500 font-semibold)
   - Resolver nome da menção via cache de participantes
3. Atualize `ConversaItem.tsx` — se o atendente logado foi mencionado, mostrar badge "@ Mencionado"
4. Atualize `useSSE.ts` — quando SSE recebe nova mensagem com menção do atendente logado, disparar notificação visual (toast) e sonora (beep)
5. Criar `src/lib/notification.ts` — helper para tocar som de notificação
6. Teste e commit

Para resolver se atendente foi mencionado: comparar telefone do atendente logado com array mencoes da mensagem. Responda em português.
