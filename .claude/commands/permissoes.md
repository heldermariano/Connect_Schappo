Leia `CLAUDE.md` e `docs/MELHORIAS_FASE2.md` (seção "Melhoria 3: Permissões por Grupo").

O atendente logado tem `grupo_atendimento` na sessão ('recepcao', 'eeg', 'todos').

Execute:

1. Atualize `/api/conversas/route.ts` — filtrar por grupo do atendente:
   - recepcao → WHERE categoria IN ('recepcao', 'geral')
   - eeg → WHERE categoria = 'eeg'
   - todos → sem filtro
2. Atualize `/api/chamadas/route.ts` — mesma lógica de filtro
3. Atualize `/api/events/route.ts` (SSE) — incluir grupo na conexão, emitir eventos apenas para quem tem permissão
4. Atualize `CategoryFilter.tsx` — mostrar apenas tabs relevantes ao grupo do atendente
5. Atualize `useConversas.ts` — passar grupo como parâmetro para a API
6. Teste: login como "renata" (eeg) deve ver só EEG, login como "paula" (recepcao) deve ver Recepção + Geral, login como "helder" (admin) deve ver tudo
7. Commit

Responda em português.
