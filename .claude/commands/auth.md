Leia `CLAUDE.md` e `docs/MELHORIAS_FASE2.md` (seção "Melhoria 2: Login por Atendente").

Execute:

1. Instale dependências: `npm install next-auth bcryptjs` e `npm install @types/bcryptjs --save-dev`
2. Execute o SQL de migração no PostgreSQL (`postgresql://connect_dev:61EIOs7zD8K5N@localhost:5432/connect_schappo`):
   - ALTER TABLE atd.atendentes para adicionar: username, password_hash, grupo_atendimento, avatar_url, ultimo_acesso, status_presenca
   - UPDATE atendentes existentes com usernames e grupos
   - INSERT admin Helder
3. Crie `src/app/api/auth/[...nextauth]/route.ts` — NextAuth com CredentialsProvider, verificação bcrypt, retorna user com id/nome/username/grupo/role/ramal
4. Crie `src/lib/auth.ts` — helper getServerSession, tipo Session customizado
5. Crie `src/app/login/page.tsx` — tela de login com logo Connect Schappo, campos username/senha, botão laranja, identidade visual da clínica
6. Atualize `src/middleware.ts` — trocar Basic Auth por verificação de sessão NextAuth. Liberar: /api/webhook/*, /api/health, /login, /_next/*, /favicon.*
7. Atualize o **Header** — mostrar nome do atendente logado + avatar + dropdown com "Sair"
8. Crie script `scripts/create-user.ts` para criar atendentes com senha hash via CLI:
   ```bash
   npx ts-node scripts/create-user.ts --username renata --password SENHA --nome "Renata" --grupo eeg --ramal 201
   ```
9. Crie senhas iniciais para teste (todos com senha "schappo123"):
   ```bash
   # Gerar hash e atualizar no banco para cada atendente
   ```
10. Teste: login, acesso protegido, logout
11. Commit

Responda em português.
