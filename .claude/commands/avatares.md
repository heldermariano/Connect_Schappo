Leia `CLAUDE.md` e `docs/MELHORIAS_FASE2.md` (seções "Melhoria 4" e "Melhoria 5").

Execute:

1. Execute SQL para criar tabela `atd.participantes_grupo` e coluna `mencoes` em atd.mensagens
2. Crie `src/components/ui/Avatar.tsx`:
   - Se tem avatar_url → mostra imagem circular
   - Se não tem → mostra iniciais em círculo colorido (cor baseada no hash do nome)
   - Props: nome, avatarUrl, tamanho (sm/md/lg)
3. Atualize `webhook-parser-uazapi.ts`:
   - Extrair `chat.imagePreview` ou `profilePicUrl` → salvar em conversas.avatar_url
   - Em mensagens de grupo: prioridade `pushName` > `senderName` > cache > número
   - Ao receber mensagem de grupo, fazer upsert em `atd.participantes_grupo`
4. Crie `src/lib/participant-cache.ts`:
   - Função `resolveParticipantName(phone, groupId)` → busca no cache
   - Função `fetchGroupParticipants(groupId, owner)` → chama UAZAPI `/group/participants`, atualiza cache
5. Atualize `ConversaItem.tsx` — usar componente Avatar
6. Atualize `MessageBubble.tsx` — em grupos, mostrar nome do remetente (resolvido) acima da mensagem, com cor diferente por pessoa
7. Atualize `MessageView.tsx` (header da conversa) — mostrar Avatar + nome + telefone
8. Teste e commit

Responda em português.
