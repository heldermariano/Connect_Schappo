# Auth e Permissoes
> Usar quando: login, roles, presenca, sessao, middleware, NextAuth, JWT

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/lib/auth.ts` | NextAuth config (CredentialsProvider, JWT 12h) |
| `src/middleware.ts` | Auth JWT: protege rotas, libera webhooks/auth/static |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handler |
| `src/app/api/atendentes/status/route.ts` | GET/PATCH: presenca operador |
| `src/app/login/page.tsx` | Tela de login |
| `src/components/ui/StatusSelector.tsx` | Dropdown mudar status |
| `src/components/ui/StatusBadge.tsx` | Badge presenca |
| `scripts/create-user.ts` | Criar usuario com senha hash |

---

## NextAuth Config

- **Provider**: CredentialsProvider (username + bcrypt password)
- **Strategy**: JWT (12h expiry)
- **Session fields**: `id` (string!), `nome`, `role`, `grupo` (campo customizado)

### session.user Gotchas

```typescript
// session.user.id eh STRING (NextAuth padrao)
const userId = parseInt(session.user.id as string);

// session.user.grupo eh campo customizado
const grupo = (session.user as { grupo?: string }).grupo;
```

### Auth Pattern nas APIs

```typescript
const session = await getServerSession(authOptions);
if (!session?.user) {
  return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
}
```

---

## Roles e Permissoes

| Role | Conversas | Contatos | Tecnicos | Supervisao | Respostas |
|------|-----------|----------|----------|------------|-----------|
| admin | Todas | Sim | Sim | Sim | Sim |
| supervisor | Grupo dele | Sim | Sim | Sim | Sim |
| atendente | Grupo dele | Sim | Nao | Nao | Sim |

- `grupo_atendimento` filtra quais categorias de conversas o operador ve
- Admin ve tudo independente do grupo

---

## Presenca (4 estados)

| Estado | Cor | Descricao |
|--------|-----|-----------|
| disponivel | Verde | Atendendo |
| pausa | Amarelo | Em pausa (rastreada) |
| ausente | Vermelho | Ausente |
| offline | Cinza | Desconectado |

- Mudanca de status: `PATCH /api/atendentes/status`
- Pause tracking: registra em `atd.atendente_pausas`
- Campo `disponivel_desde` em atendentes

---

## Middleware

Rotas liberadas (sem auth): `/api/webhook/*`, `/api/auth/*`, `/api/health`, `/_next/*`, `/favicon.*`, `/sounds/*`, `/manifest.json`

---

## Banco de Dados

### Tabela `atd.atendentes`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| nome | TEXT | |
| username | TEXT UNIQUE | |
| password_hash | TEXT | bcrypt |
| ramal | TEXT | |
| grupo_atendimento | TEXT | Categoria de conversas |
| role | TEXT | admin, supervisor, atendente |
| status_presenca | TEXT | disponivel, pausa, ausente, offline |
| disponivel_desde | TIMESTAMPTZ | |
| sip_enabled | BOOLEAN | Ramal WebRTC individual |

### Tabela `atd.atendente_pausas`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| atendente_id | FK | |
| tipo | TEXT | Tipo de pausa |
| inicio_at | TIMESTAMPTZ | |
| fim_at | TIMESTAMPTZ | |

## SSE Events Relacionados

`atendente_status` — ver skill `sse-realtime`
