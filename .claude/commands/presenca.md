Leia `CLAUDE.md` e `docs/MELHORIAS_FASE2.md` (seção "Melhoria 6: Status do Atendente").

Execute:

1. Crie `src/components/ui/StatusBadge.tsx` — bolinha colorida (🟢 disponível, 🟡 pausa, 🔴 ausente, ⚫ offline)
2. Crie `src/components/ui/StatusSelector.tsx` — dropdown para trocar status com ícones e labels
3. Crie `src/app/api/atendentes/status/route.ts`:
   - PATCH: recebe { status }, atualiza banco, envia AMI QueuePause se tem ramal, emite SSE
   - GET: retorna status de todos os atendentes (para admin ver)
4. Atualize `ami-listener.ts` — adicionar funções:
   - `pauseQueue(ramal, paused, reason)` → envia Action QueuePause ao AMI
   - Tratar erros se AMI offline (fallback gracioso)
5. Atualize o **Header** — ao lado do nome do atendente, mostrar StatusBadge + StatusSelector
6. Emitir SSE `atendente_status` quando alguém muda status (outros veem em tempo real)
7. Ao fazer login → atualizar status para 'disponivel' + ultimo_acesso
8. Ao fazer logout → atualizar status para 'offline'
9. Teste e commit

Responda em português.
