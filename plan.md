# Plano: Gerenciamento de Usuários + Plantões Automáticos

## Contexto
Operadores ficam com status "disponível" permanentemente porque não se desconectam. Precisamos:
1. **Página de gerenciamento de usuários** (CRUD completo) — admin/supervisor
2. **Horários de plantão por operador** — para controle automático de status
3. **Auto-offline fora do horário** — sistema muda para offline automaticamente

---

## 1. Migração SQL (`sql/017_plantoes_usuarios.sql`)

Adicionar colunas de plantão na tabela `atd.atendentes`:

```sql
ALTER TABLE atd.atendentes
  ADD COLUMN IF NOT EXISTS plantao_inicio TIME,
  ADD COLUMN IF NOT EXISTS plantao_fim TIME,
  ADD COLUMN IF NOT EXISTS plantao_dias INTEGER[] DEFAULT '{1,2,3,4,5}';
-- 0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sab
```

Se `plantao_inicio` e `plantao_fim` são NULL, não aplica controle de horário.

---

## 2. API de Gerenciamento de Usuários

### `src/app/api/usuarios/route.ts`
- **GET**: Lista todos os atendentes (admin/supervisor)
- **POST**: Criar novo operador (nome, username, senha, grupo, role, ramal, plantão)

### `src/app/api/usuarios/[id]/route.ts`
- **GET**: Detalhe do operador
- **PUT**: Editar operador (dados + plantão)
- **DELETE**: Desativar operador (`ativo = false`)
- **PATCH**: Reset de senha

Apenas admin e supervisor podem acessar. Supervisor não pode criar/editar admins.

---

## 3. Página de Gerenciamento (`/usuarios`)

### UI
- Tabela com todos os operadores
- Colunas: Nome | Username | Grupo | Role | Ramal | Plantão | Status | Ações
- Botão "Novo Usuário" abre modal
- Cada linha: Editar | Desativar/Ativar | Reset Senha
- Filtro por grupo e status ativo/inativo

### Modal de Criação/Edição (`UsuarioModal.tsx`)
Campos:
- Nome, Username, Senha, Grupo, Role, Ramal, Telefone, Email
- **Plantão início** (time picker)
- **Plantão fim** (time picker)
- **Dias da semana** (checkboxes Seg-Dom)

---

## 4. Auto-Offline por Plantão

### Em `/api/supervisao/me`
Verificar se operador tem plantão configurado e está fora do horário → retornar `fora_do_plantao: true`.

### Em `AppShell.tsx` (a cada 30s)
Se `fora_do_plantao === true`:
- Mudar status para `offline` automaticamente
- Não mostrar alerta de inatividade

Se operador está `offline` (auto) e entra no horário do plantão:
- Mudar para `disponível` automaticamente

---

## 5. Navegação — Sidebar

Adicionar item "Usuários" visível para admin e supervisor.

---

## 6. Arquivos

### Novos:
- `sql/017_plantoes_usuarios.sql`
- `src/app/api/usuarios/route.ts`
- `src/app/api/usuarios/[id]/route.ts`
- `src/app/(app)/usuarios/page.tsx`
- `src/components/usuarios/UsuarioModal.tsx`

### Modificar:
- `src/components/layout/Sidebar.tsx`
- `src/app/api/supervisao/me/route.ts`
- `src/components/layout/AppShell.tsx`

---

## Ordem de Implementação

1. Migração SQL
2. API CRUD de usuários
3. Página + modal de gerenciamento
4. Sidebar (nav item)
5. Lógica auto-offline por plantão
