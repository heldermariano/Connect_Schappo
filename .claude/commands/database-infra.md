# Banco de Dados e Infraestrutura
> Usar quando: schema SQL, migracoes, pools, Docker, Traefik, deploy, conexoes banco

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/lib/db.ts` | Pool escrita (`pool`) + leitura (`poolRead`) |
| `src/lib/db-exames.ts` | Pool externo neuro_schappo (read-only, max 5) |
| `src/lib/db-agenda.ts` | Pool externo schappo ERP (LATIN1, max 3, sem defaults) |
| `src/lib/db-chatwoot.ts` | Pool Chatwoot (somente migracao) |
| `src/lib/redis.ts` | Cliente Redis (ioredis) + factory subscriber |
| `Dockerfile` | Multi-stage Node 20 Alpine (TZ + tzdata) |
| `docker-compose.yml` | Producao com Traefik + Let's Encrypt + Redis |
| `docker-compose.test.yml` | Ambiente de teste isolado na porta 3001 |
| `sql/*.sql` | Migracoes 001-021 |

---

## Pools de Conexao

| Pool | Arquivo | DB | User | Max | Uso |
|------|---------|-----|------|-----|-----|
| Escrita | `db.ts` (default) | connect_schappo | `connect_write` | default | INSERT/UPDATE/DELETE |
| Leitura | `db.ts` (`poolRead`) | connect_schappo | `connect_read` | 15 | SELECT-only |
| Exames | `db-exames.ts` | neuro_schappo | neuro_schappo | 5 | Busca exames (read-only) |
| Agenda | `db-agenda.ts` | schappo | via env | 3 | ERP agendamento (LATIN1) |
| Chatwoot | `db-chatwoot.ts` | chatwoot | postgres | - | Somente migracao |

Todos os pools configuram `SET timezone TO 'America/Sao_Paulo'` no `pool.on('connect')`.

### Usuarios DB (roles)

| Role | Permissoes | Variavel |
|------|-----------|----------|
| `connect_write` | SELECT, INSERT, UPDATE, DELETE + sequences + functions | `DATABASE_URL` |
| `connect_read` | SELECT only | `DATABASE_READ_URL` |

Criados em `sql/021_db_users_separation.sql`. O `poolRead` faz fallback para `DATABASE_URL` se `DATABASE_READ_URL` nao estiver definida.

---

## Migracoes SQL

Executar em ordem com psql. Arquivos em `sql/`:

| Arquivo | Descricao |
|---------|-----------|
| 001 | Schema base: atendentes, conversas, mensagens, chamadas |
| 002 | Auth: username, password_hash, grupo_atendimento |
| 003 | participantes_grupo (sync nomes/avatares) |
| 004 | Campo mencoes[] + trigger |
| 005 | Tabela contatos |
| 006 | Campos SIP em atendentes |
| 007 | Chat interno (tabelas) |
| 008 | Campo ultima_msg_from_me |
| 009 | Unique index wa_chatid + categoria |
| 010 | Respostas prontas |
| 011 | Campo edited_at em mensagens |
| 012 | Hub tecnicos + alertas fichas |
| 013 | Timezone America/Sao_Paulo + TIMESTAMPTZ |
| 014 | Paciente nome + data exame em alertas |
| 015 | Disponivel_desde, normalize_telefones, confirmacao_agendamento, chat_interno_media |
| 016 | Atendente_pausas, template_confirmacao |
| 017 | Ramais PJSIP individuais (251-259) |
| 018 | EEG exame ficha vinculo |
| 019 | Mensagens soft-delete |
| 020 | wa_message_id composite unique (chatid+categoria) |
| 021 | Separacao usuarios DB (connect_read + connect_write) |

---

## Funcoes SQL

| Funcao | Descricao |
|--------|-----------|
| `atd.upsert_conversa()` | Insert/update conversa por wa_chatid |
| `atd.registrar_mensagem()` | Insert mensagem + update conversa |
| `atd.normalize_phone()` | Normalizar telefone BR (55+DDD+9) — triggers |

---

## Deploy Producao

- **Servidor**: `10.150.77.105` (Traefik v2.11 + Docker)
- **Dominio**: `connect.clinicaschappo.com` (SSL auto Let's Encrypt)
- **User SSH**: `treafik_proxy` (nao root)
- **Repo**: `/home/treafik_proxy/connect-schappo/`

### Procedimento

```bash
ssh treafik_proxy@10.150.77.105
cd ~/connect-schappo
git pull origin main
# Atualizar .env se necessario (nao versionado)
docker compose build
docker compose up -d --force-recreate
# Verificar: docker logs --tail 20 connect-schappo-connect-schappo-1
```

**ATENCAO**: O `.env` na producao (`/home/treafik_proxy/connect-schappo/.env`) nao eh versionado. Se novas variaveis forem adicionadas, atualizar manualmente via SSH antes do build.

### Docker

- Multi-stage Node 20 Alpine
- `TZ=America/Sao_Paulo` + `apk add tzdata`
- Standalone output
- Traefik roteia via Docker provider (labels)
- **Duas redes**: `traefik_default` (Traefik) + `internal` (Redis)
- **OBRIGATORIO**: label `traefik.docker.network=traefik_default` — sem isso, Traefik pode resolver IP pela rede errada e dar 503
- **REDIS_URL** override no `environment:` do docker-compose (`redis://redis:6379`) — hostname `redis` resolve via rede `internal`
- `.env` eh copiado para dentro da imagem no build (`COPY . .`), nao via volume

### pg_hba.conf (PostgreSQL)

Arquivo em `/etc/postgresql/16/main/pg_hba.conf` no servidor `10.150.77.78`.
Requer regras para cada user+IP. Apos editar: `sudo -u postgres psql -c "SELECT pg_reload_conf();"`.

| User | IPs permitidos |
|------|---------------|
| `connect_dev` | `10.150.77.105/32`, `172.16.0.0/12` |
| `connect_write` | `10.150.77.105/32`, `10.150.77.0/24`, `172.16.0.0/12` |
| `connect_read` | `10.150.77.105/32`, `10.150.77.0/24`, `172.16.0.0/12` |

**CUIDADO**: Cada linha deve estar numa unica linha — quebras de linha invalidam a regra e o PG ignora silenciosamente.

---

## Timezone

| Camada | Configuracao |
|--------|-------------|
| Node.js | `TZ=America/Sao_Paulo` em .env, Dockerfile, docker-compose |
| PostgreSQL DB | `ALTER DATABASE SET timezone TO 'America/Sao_Paulo'` |
| PostgreSQL conexao | `SET timezone` no pool.on('connect') |
| Docker Alpine | `apk add tzdata` + `ENV TZ` |

**IMPORTANTE**: Todas as colunas de data devem usar `TIMESTAMPTZ` (nao `TIMESTAMP`).

---

## Regras

1. **Schema `atd` sempre** — Nunca usar schema `public`
2. **queryLatin1()** — Obrigatorio para queries ao banco schappo ERP
3. **CUIDADO**: NAO rodar `npm run dev` na porta 3000 quando container Docker estiver rodando
4. **CUIDADO**: Nunca colocar `package.json` no diretorio pai (`/home/connect_schappo/`)
