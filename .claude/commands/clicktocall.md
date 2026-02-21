Leia `CLAUDE.md` e `docs/MELHORIAS_FASE2.md` (seção "Melhoria 7: Click-to-Call").

Execute:

1. Atualize `ami-listener.ts` — adicionar função `originate(ramal, destino, callerId)`:
   ```
   Action: Originate
   Channel: SIP/{ramal}
   Exten: {destino}
   Context: from-internal
   Priority: 1
   CallerID: "Connect Schappo" <33455701>
   Async: true
   ```
2. Crie `src/app/api/calls/originate/route.ts`:
   - POST: recebe { destino }, pega ramal do atendente logado, chama originate
   - Validações: atendente tem ramal? está disponível? destino é válido?
   - Retorna { success, callId }
3. Crie `src/components/calls/CallButton.tsx` — botão 📞 com loading state
4. Atualize `MessageView.tsx` (header) — adicionar CallButton ao lado do nome/telefone do contato
5. Atualize `CallItem.tsx` — botão de rediscar
6. Atualize `CallAlert.tsx` — mostrar quando chamada originada está conectando
7. Teste (precisa de AMI acessível) e commit

Se AMI não estiver acessível do servidor de dev, implemente com fallback que mostra toast "AMI não disponível". Responda em português.
