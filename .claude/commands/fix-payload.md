Leia `docs/CORRECAO_PAYLOAD_UAZAPI.md` — contém as correções URGENTES baseadas em payloads reais da UAZAPI.

Os payloads reais diferem significativamente do que foi documentado. Execute TODAS as correções:

1. **Atualize `src/lib/webhook-parser-uazapi.ts`** com o código corrigido do documento. Pontos críticos:
   - `message.text` é sempre string (usar este, não `message.content`)
   - `message.content` pode ser string OU objeto com `{text, contextInfo}`
   - `message.sender` é LID (`@lid`), NÃO telefone! Usar `message.sender_pn`
   - `chat.wa_contactName` geralmente vazio → usar `chat.name` ou `chat.wa_name`
   - `chat.imagePreview` é URL (não base64)
   - `message.messageid` (sem prefixo owner) para campo UNIQUE no banco
   - Normalizar messageType: 'Conversation' e 'ExtendedTextMessage' → 'text'

2. **Atualize `src/lib/types.ts`** — corrigir interface WebhookPayloadUAZAPI:
   - Adicionar campos: `BaseUrl`, `instanceName`, `token`, `chatSource`
   - Corrigir `message.content` para `string | { text: string; contextInfo?: any }`
   - Adicionar: `sender_pn`, `sender_lid`, `chatlid`, `messageid`
   - Adicionar em chat: `name`, `wa_name`, `phone`, `wa_unreadCount`

3. **Atualize `CLAUDE.md`** — seção do payload UAZAPI e tabela de mapeamento conforme o documento de correção

4. **Atualize `/api/webhook/uazapi/route.ts`** se necessário:
   - Validação com `body.token` em vez de header token
   - Usar parser corrigido

5. **Teste** — simule um POST para `/api/webhook/uazapi` com os payloads reais (tem 2 exemplos no docs/CORRECAO_PAYLOAD_UAZAPI.md)

6. **Commit**: `git commit -m "fix: corrigir parser UAZAPI com payload real (LID, content object, nomes)"`

Responda em português. Estas correções são CRÍTICAS — sem elas, mensagens serão perdidas ou terão dados errados.
