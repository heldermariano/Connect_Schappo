Leia o arquivo CLAUDE.md na raiz do projeto para entender o contexto completo.

Execute a **Fase 1C — Canal Telefonia PABX (Issabel AMI)** do checklist:

1. Instale a dependência: `npm install asterisk-manager`
2. Crie `src/lib/ami-listener.ts` — conexão AMI via socket TCP, escuta eventos (Newchannel, DialBegin, BridgeEnter, Hangup, VoicemailStart), persiste em atd.chamadas, emite SSE
3. Identifique origem: contexto 'from-whatsapp' → origem 'whatsapp', 'from-external' → origem 'telefone'
4. Crie `src/app/api/chamadas/route.ts` — GET log de chamadas com filtros
5. Crie componentes: `CallLog.tsx`, `CallItem.tsx`, `CallAlert.tsx`, `RamalStatus.tsx`
6. Crie hook: `useChamadas.ts`
7. Crie página: `src/app/chamadas/page.tsx`
8. Integre alertas de chamada no layout principal
9. Teste e commit

AMI_HOST pode não estar acessível do servidor de dev. Implemente com reconnect automático e fallback gracioso. Responda em português.
