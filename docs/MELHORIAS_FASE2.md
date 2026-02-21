# Connect Schappo — Melhorias Fase 2

## Plano de Execução (por prioridade)

---

## Melhoria 1: Logo + Identidade Visual

### Paleta de cores (extraída da logo da Clínica Schappo)

```
Laranja principal:  #F58220  (cor dominante)
Laranja escuro:     #D96E0A  (hover/active)
Laranja claro:      #FFA64D  (backgrounds sutis)
Preto:              #1A1A1A  (texto principal)
Cinza escuro:       #6B6B6B  (texto secundário, "Schappo" na logo)
Cinza médio:        #9CA3AF  (bordas, placeholders)
Cinza claro:        #F3F4F6  (backgrounds)
Branco:             #FFFFFF  (fundo principal)
```

### Onde aplicar

1. **tailwind.config.ts** — adicionar cores customizadas:
   ```
   colors: {
     schappo: {
       50:  '#FFF7ED',
       100: '#FFEDD5',
       200: '#FED7AA',
       300: '#FDBA74',
       400: '#FFA64D',
       500: '#F58220',  ← cor principal
       600: '#D96E0A',
       700: '#C2610A',
       800: '#9A3412',
       900: '#7C2D12',
     }
   }
   ```

2. **Header** — fundo laranja #F58220, texto branco
3. **Sidebar** — fundo escuro (#1A1A1A ou #1F2937) com ícones laranja quando ativo
4. **Botões primários** — bg-schappo-500, hover:bg-schappo-600
5. **Badge de não lidas** — bg-schappo-500
6. **Favicon** — gerar a partir da logo (formato .ico e .png)
7. **Logo no header** — texto "Connect Schappo" com "Connect" em laranja e "Schappo" em branco (ou vice-versa)
8. **Logo na tela de login** — logo completa centralizada
9. **Linha de EEG** — usar a onda da logo (~~~) como elemento decorativo sutil

### Logo "Connect Schappo"

Seguir o estilo da logo da Clínica Schappo:
- "Connect" em **laranja (#F58220)** 
- "Schappo" em **cinza (#6B6B6B)** ou branco (dependendo do fundo)
- Onda de EEG (~~~) como underline decorativo
- Font: semibold/bold, sans-serif

### Arquivo da logo original

A logo da Clínica Schappo está em: `public/logo-clinica.jpg`
(copiar do upload para o projeto)

---

## Melhoria 2: Login por Atendente + Logout

### Mudanças necessárias

#### Banco de dados (atd.atendentes)

Adicionar colunas:
```sql
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200);
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS grupo_atendimento VARCHAR(30) DEFAULT 'todos';
  -- 'recepcao', 'eeg', 'todos' (admin/supervisor)
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS status_presenca VARCHAR(20) DEFAULT 'disponivel';
  -- 'disponivel', 'ausente', 'pausa', 'offline'

-- Dados iniciais (atualizar atendentes existentes)
UPDATE atd.atendentes SET username = 'renata', grupo_atendimento = 'eeg' WHERE nome = 'Renata';
UPDATE atd.atendentes SET username = 'paula', grupo_atendimento = 'recepcao' WHERE nome = 'Paula';
UPDATE atd.atendentes SET username = 'jefferson', grupo_atendimento = 'eeg' WHERE nome = 'Jefferson';
UPDATE atd.atendentes SET username = 'claudia', grupo_atendimento = 'recepcao' WHERE nome = 'Claudia Santrib';

-- Admin/supervisor vê tudo
INSERT INTO atd.atendentes (nome, username, grupo_atendimento, role, ramal) 
VALUES ('Helder', 'helder', 'todos', 'admin', NULL)
ON CONFLICT DO NOTHING;
```

#### Autenticação

- Usar **NextAuth.js** com provider "Credentials"
- Hash de senha com **bcrypt**
- Session via JWT (sem banco de sessão)
- Middleware: trocar Basic Auth por verificação de sessão NextAuth

#### Tela de login

- Logo Connect Schappo centralizada
- Campos: username + senha
- Botão laranja "Entrar"
- Background com identidade visual (laranja + branco)

#### Botão de logout

- No header, à direita
- Mostra nome + avatar do atendente logado
- Dropdown: "Meu perfil", "Alterar senha", "Sair"

#### Dependências npm

```bash
npm install next-auth bcryptjs
npm install @types/bcryptjs --save-dev
```

---

## Melhoria 3: Permissões por Grupo de Atendimento

### Regras de visibilidade

```
┌───────────────────────┬─────────────────────────────────────────────────┐
│ grupo_atendimento     │ O que vê                                        │
├───────────────────────┼─────────────────────────────────────────────────┤
│ 'recepcao'            │ categoria: 'recepcao' + 'geral'                │
│                       │ tipos: individual + grupo                       │
│                       │ Números: 556183008973 + 556133455701            │
├───────────────────────┼─────────────────────────────────────────────────┤
│ 'eeg'                 │ categoria: 'eeg'                                │
│                       │ tipos: individual + grupo                       │
│                       │ Número: 556192894339                            │
├───────────────────────┼─────────────────────────────────────────────────┤
│ 'todos' (admin/super) │ Todas as categorias e tipos                    │
│                       │ Todos os números                                │
└───────────────────────┴─────────────────────────────────────────────────┘
```

### Onde aplicar

1. **API `/api/conversas`** — filtrar por grupo do atendente logado
   ```sql
   -- Se grupo = 'recepcao'
   WHERE categoria IN ('recepcao', 'geral')
   
   -- Se grupo = 'eeg'  
   WHERE categoria = 'eeg'
   
   -- Se grupo = 'todos'
   -- sem filtro de categoria
   ```

2. **API `/api/chamadas`** — filtrar chamadas pelo grupo
3. **Frontend (CategoryFilter)** — mostrar apenas tabs relevantes:
   - Recepção: "Todos | Individual | Grupos Recepção | Geral"
   - EEG: "Todos | Individual | Grupos EEG"
   - Admin: "Todos | Individual | Grupos EEG | Grupos Recepção | Geral"

4. **SSE** — emitir eventos apenas para atendentes que têm permissão de ver aquela conversa

---

## Melhoria 4: Foto de Perfil dos Contatos

### Como buscar via UAZAPI

```
GET /chat/find?owner=556192894339&chatid=5561999999999@s.whatsapp.net
Header: token = UAZAPI_TOKEN
```

Resposta inclui `imagePreview` (base64) ou `profilePicUrl`.

### Estratégia

1. **Ao receber webhook** — se `chat.imagePreview` vier no payload, salvar em `atd.conversas.avatar_url`
2. **Job periódico** (a cada 24h) — buscar avatares faltantes via UAZAPI `/chat/find`
3. **Cache** — salvar avatar como URL base64 no banco (evitar chamadas repetidas)
4. **Fallback** — se não tiver foto, mostrar iniciais do nome em círculo colorido

### Componente Avatar

```
┌──────────────────┐
│  Se tem foto:     │  → <img src={avatar_url} className="rounded-full" />
│  Se não tem:      │  → <div className="rounded-full bg-schappo-500">JS</div>
│                   │     (iniciais: "João Silva" → "JS")
└──────────────────┘
```

Cor do fallback baseada no hash do nome (para ser consistente):
```typescript
const colors = ['bg-schappo-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];
const colorIndex = nome.charCodeAt(0) % colors.length;
```

---

## Melhoria 5: Nome Correto em Mensagens de Grupo

### Problema

Em grupos, a UAZAPI envia `senderPhone` como `5561999999999@s.whatsapp.net` e às vezes `senderName` vem vazio ou com o número.

### Solução

1. **Tabela de cache de participantes**:
   ```sql
   CREATE TABLE atd.participantes_grupo (
       id              SERIAL PRIMARY KEY,
       wa_phone        VARCHAR(50) NOT NULL,      -- 5561999999999
       wa_chatid       VARCHAR(100),               -- grupo onde está
       nome_whatsapp   VARCHAR(200),               -- nome do perfil WhatsApp
       nome_salvo      VARCHAR(200),               -- nome salvo na agenda (pushName)
       avatar_url      TEXT,
       atualizado_at   TIMESTAMPTZ DEFAULT NOW(),
       UNIQUE(wa_phone, wa_chatid)
   );
   ```

2. **Ao receber mensagem de grupo** — se `senderName` veio com nome real, salvar no cache
3. **Se `senderName` está vazio** — buscar via UAZAPI:
   ```
   GET /group/participants?groupId=GRUPO_ID@g.us&owner=OWNER
   ```
   Retorna lista com `{ id, name, isAdmin }` de cada participante
4. **No frontend** — resolver o nome antes de exibir:
   ```
   senderName || cacheParticipantes[senderPhone] || formatarTelefone(senderPhone)
   ```

### Webhook UAZAPI — campos relevantes em mensagens de grupo

```json
{
  "message": {
    "senderPhone": "5561999999999@s.whatsapp.net",
    "senderName": "João",          // às vezes vem, às vezes não
    "pushName": "João Silva",      // nome do perfil WhatsApp (mais confiável)
    "chatid": "120363xxx@g.us"     // ID do grupo
  }
}
```

**Prioridade de nome**: `pushName` > `senderName` > cache > número formatado

---

## Melhoria 6: Status do Atendente (Disponível/Ausente/Pausa)

### Status possíveis

```
🟢 Disponível  — recebe chamadas + mensagens
🟡 Pausa       — não recebe chamadas, mensagens acumulam (temporário: almoço, café)
🔴 Ausente     — não recebe nada (fim do expediente)
⚫ Offline      — não logado
```

### Onde aparece

1. **Header** — badge ao lado do nome do atendente (bolinha colorida)
2. **Toggle no header** — dropdown para trocar status
3. **Lista de atendentes** (admin vê) — quem está online/pausa/ausente

### Integração com Issabel (PABX)

Quando atendente muda status:
- **Pausa/Ausente** → AMI: `QueuePause` (pausa o ramal na fila de atendimento)
  ```
  Action: QueuePause
  Interface: SIP/RAMAL
  Paused: true
  Reason: pausa_almoco
  ```
- **Disponível** → AMI: `QueuePause` com `Paused: false`
  ```
  Action: QueuePause
  Interface: SIP/RAMAL
  Paused: false
  ```

### Banco de dados

Usar a coluna `atd.atendentes.status_presenca` (já adicionada na Melhoria 2):
```sql
UPDATE atd.atendentes SET status_presenca = 'pausa', updated_at = NOW() WHERE id = X;
```

### API

```
PATCH /api/atendentes/status
Body: { "status": "pausa" | "disponivel" | "ausente" }
```

Esse endpoint:
1. Atualiza banco
2. Envia comando AMI (QueuePause) se atendente tem ramal
3. Emite SSE para outros atendentes verem a mudança

---

## Melhoria 7: Click-to-Call (fazer ligações pelo painel)

### Como funciona

1. Atendente clica no ícone 📞 ao lado do número do contato
2. Frontend chama: `POST /api/calls/originate`
3. API envia AMI Originate:
   ```
   Action: Originate
   Channel: SIP/RAMAL_DO_ATENDENTE
   Exten: NUMERO_DESTINO
   Context: from-internal
   Priority: 1
   CallerID: "Connect Schappo" <3345-5701>
   Async: true
   ```
4. O **ramal do atendente toca primeiro**
5. Quando atendente atende → liga para o número do contato
6. Chamada aparece no painel via AMI events (já capturados pela Fase 1C)

### API

```
POST /api/calls/originate
Body: { 
  "destino": "5561999999999",     // número do contato
  "ramal": "201"                   // ramal do atendente (ou pegar do perfil logado)
}
```

### Frontend

- Botão 📞 no header da conversa (ao lado do nome do contato)
- Botão 📞 na lista de chamadas (rediscar)
- Indicador visual enquanto chamada está ativa

---

## Melhoria 8: Menções (@) em Grupos

### Recebendo menções (webhook)

UAZAPI envia menções no campo `mentionedJid`:
```json
{
  "message": {
    "content": "@João precisa devolver a C3 hoje",
    "mentionedJid": ["5561999999999@s.whatsapp.net"]
  }
}
```

### Exibindo no frontend

- Texto mencionado em **negrito laranja** dentro do balão
- Se o atendente logado foi mencionado → **badge especial** na conversa ("Você foi mencionado")
- Notificação sonora quando mencionado

### Enviando menções (Fase 2 — quando tiver envio)

```json
POST /send/text
{
  "phone": "120363xxx@g.us",
  "message": "@5561999999999 precisa devolver a C3",
  "mentionedJid": ["5561999999999@s.whatsapp.net"]
}
```

---

## Ordem de Implementação (comandos para Claude Code)

```
Bloco A: Visual + Auth (Melhorias 1, 2, 3)
├── Identidade visual (cores, logo, favicon)
├── NextAuth (login/logout)
├── Permissões por grupo
└── Estimativa: ~8h

Bloco B: Contatos + Grupos (Melhorias 4, 5)
├── Foto de perfil (avatar)
├── Cache de participantes
├── Resolver nomes em grupos
└── Estimativa: ~4h

Bloco C: Presença + Telefonia (Melhorias 6, 7)
├── Status do atendente
├── Integração QueuePause (AMI)
├── Click-to-call (AMI Originate)
└── Estimativa: ~5h

Bloco D: Menções (Melhoria 8)
├── Parser de menções no webhook
├── Destaque visual no frontend
├── Notificação para mencionado
└── Estimativa: ~3h

Total: ~20h
```

---

## SQL Completo das Alterações

```sql
-- =========================================================
-- MIGRAÇÃO: Melhorias Fase 2
-- =========================================================

-- 1. Novas colunas em atd.atendentes
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200);
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS grupo_atendimento VARCHAR(30) DEFAULT 'todos';
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS status_presenca VARCHAR(20) DEFAULT 'disponivel';

-- 2. Atualizar atendentes existentes
UPDATE atd.atendentes SET username = 'renata', grupo_atendimento = 'eeg' WHERE nome = 'Renata';
UPDATE atd.atendentes SET username = 'paula', grupo_atendimento = 'recepcao' WHERE nome = 'Paula';
UPDATE atd.atendentes SET username = 'jefferson', grupo_atendimento = 'eeg' WHERE nome = 'Jefferson';
UPDATE atd.atendentes SET username = 'claudia', grupo_atendimento = 'recepcao' WHERE nome = 'Claudia Santrib';

-- 3. Admin
INSERT INTO atd.atendentes (nome, username, grupo_atendimento, role, ramal)
VALUES ('Helder', 'helder', 'todos', 'admin', NULL)
ON CONFLICT DO NOTHING;

-- 4. Tabela de participantes de grupo
CREATE TABLE IF NOT EXISTS atd.participantes_grupo (
    id              SERIAL PRIMARY KEY,
    wa_phone        VARCHAR(50) NOT NULL,
    wa_chatid       VARCHAR(100),
    nome_whatsapp   VARCHAR(200),
    nome_salvo      VARCHAR(200),
    avatar_url      TEXT,
    atualizado_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wa_phone, wa_chatid)
);

CREATE INDEX IF NOT EXISTS idx_participantes_phone ON atd.participantes_grupo(wa_phone);
CREATE INDEX IF NOT EXISTS idx_participantes_grupo ON atd.participantes_grupo(wa_chatid);

-- 5. Coluna de menções nas mensagens
ALTER TABLE atd.mensagens ADD COLUMN IF NOT EXISTS mencoes TEXT[] DEFAULT '{}';
```

---

*Plano de Melhorias — Connect Schappo Fase 2*
*Total estimado: ~20h*
