Leia o arquivo CLAUDE.md na raiz do projeto para entender o contexto completo.

Execute a **Fase 1A — Infraestrutura Base** do checklist:

1. Execute o schema SQL completo no PostgreSQL (connection string: `postgresql://connect_dev:61EIOs7zD8K5N@localhost:5432/connect_schappo`)
2. Crie `sql/001_schema_atd.sql` com o SQL para versionamento
3. Crie `src/lib/db.ts` — pool de conexão PostgreSQL
4. Crie `src/lib/types.ts` — tipos TypeScript para Conversa, Mensagem, Chamada, Atendente, SSEEvent, WebhookPayloadUAZAPI, WebhookPayload360Dialog
5. Crie `src/app/api/health/route.ts` — health check (verifica DB, retorna status)
6. Crie `src/middleware.ts` — Basic Auth (libera /api/webhook/* e /api/health, protege o resto)
7. Verifique que `.env.local` existe com DATABASE_URL correta
8. Rode `npm run dev` e teste o health check
9. Faça commit e push

Responda em português. Siga as convenções do CLAUDE.md.
