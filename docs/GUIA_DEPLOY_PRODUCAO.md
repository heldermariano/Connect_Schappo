# Guia de Deploy — Connect Schappo (Producao)

Deploy da plataforma no servidor de producao com Docker + Traefik.

---

## Infraestrutura

| Recurso | Endereco |
|---------|----------|
| Servidor Traefik (producao) | `10.150.77.105` |
| Servidor dev (atual) | `10.150.77.78` |
| Dominio | `connect.clinicaschappo.com` |
| PostgreSQL | `localhost:5432` (no servidor de producao) |

---

## Pre-requisitos no servidor 10.150.77.105

- Docker e Docker Compose instalados
- Traefik rodando com rede `traefik-public` e `internal`
- Certificado TLS automatico via Let's Encrypt (certresolver `letsencrypt`)
- PostgreSQL acessivel em `localhost` ou via `host.docker.internal`
- DNS de `connect.clinicaschappo.com` apontando para `10.150.77.105`

### Verificar redes Docker

```bash
# No servidor 10.150.77.105
docker network ls | grep -E "traefik-public|internal"

# Se nao existirem:
docker network create traefik-public
docker network create internal
```

---

## Passo a Passo

### 1. Clonar repositorio no servidor de producao

```bash
ssh root@10.150.77.105
cd /opt
git clone https://github.com/heldermariano/Connect_Schappo.git connect-schappo
cd connect-schappo
```

### 2. Criar arquivo .env

```bash
cp .env.local .env   # se copiando do dev
# OU criar manualmente:
nano .env
```

Conteudo do `.env`:

```env
# PostgreSQL
DATABASE_URL=postgresql://connect_dev:SENHA_PRODUCAO@host.docker.internal:5432/connect_schappo

# UAZAPI
UAZAPI_URL=https://sua-instancia.uazapi.com
UAZAPI_TOKEN=token_producao

# 360Dialog
DIALOG360_API_URL=https://waba-v2.360dialog.io
DIALOG360_API_KEY=api_key_producao

# Owners
OWNER_EEG=556192894339
OWNER_RECEPCAO=556183008973
OWNER_GERAL=556133455701

# Issabel AMI
AMI_HOST=host.docker.internal
AMI_PORT=5038
AMI_USER=admin
AMI_PASSWORD=senha_ami_producao

# Seguranca
WEBHOOK_SECRET=token_seguro_producao
PANEL_USER=admin
PANEL_PASS=senha_segura_producao

# NextAuth (obrigatorio em producao)
NEXTAUTH_SECRET=gerar_com_openssl_rand_base64_32
NEXTAUTH_URL=https://connect.clinicaschappo.com

# Timezone
TZ=America/Sao_Paulo

# App
NEXT_PUBLIC_APP_URL=https://connect.clinicaschappo.com
NEXT_PUBLIC_APP_NAME=Connect Schappo
```

**IMPORTANTE**: O container usa `host.docker.internal` para acessar servicos no host (PostgreSQL, Asterisk AMI). Isso e resolvido pela diretiva `extra_hosts` no docker-compose.yml.

### 3. Executar migracoes SQL (primeira vez)

```bash
# Executar todas as migracoes em ordem (001 a 013):
for f in sql/0*.sql; do
  echo "Executando $f..."
  psql -U connect_dev -d connect_schappo -f "$f"
done

# Ou individualmente (se banco em outro servidor):
psql postgresql://connect_dev:SENHA@HOST:5432/connect_schappo -f sql/001_schema_atd.sql
# ... ate sql/013_fix_timestamps_tz.sql
```

**IMPORTANTE**: A migracao 013 configura timezone `America/Sao_Paulo` no database. Apos executar, verificar:
```bash
psql -U connect_dev -d connect_schappo -c "SELECT NOW(), current_setting('timezone')"
# Deve retornar horario de Brasilia (GMT-3) e 'America/Sao_Paulo'
```

### 4. Build e deploy

```bash
# Build da imagem (usar --network=host se necessario)
docker compose build --network=host

# Subir em background
docker compose up -d

# Verificar logs
docker compose logs -f connect-schappo
```

### 5. Verificar deploy

```bash
# Health check interno
docker exec connect-schappo wget -qO- http://localhost:3000/api/health

# Health check externo (via Traefik)
curl -s https://connect.clinicaschappo.com/api/health

# Status do container
docker compose ps
```

Resposta esperada:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "phase": "1C",
  "checks": {
    "database": "ok",
    "ami": "connected",
    "ami_active_calls": "0"
  }
}
```

---

## Operacoes comuns

### Atualizar para nova versao

```bash
cd /opt/connect-schappo
git pull origin main
docker compose build --network=host
docker compose up -d
```

### Ver logs

```bash
docker compose logs -f --tail=100 connect-schappo
```

### Reiniciar

```bash
docker compose restart connect-schappo
```

### Parar

```bash
docker compose down
```

---

## Configurar webhooks

Apos o deploy, configurar os webhooks para apontar para o servidor de producao:

### UAZAPI (numeros EEG + Recepcao)

Configurar webhook #2 em cada instancia UAZAPI:
- URL: `https://connect.clinicaschappo.com/api/webhook/uazapi`
- Header: `token: TOKEN_SEGURO_PRODUCAO`
- Eventos: `messages`, `call`

**NAO alterar** o webhook #1 (N8N) — continua funcionando independente.

### 360Dialog (numero Geral)

Configurar webhook no painel 360Dialog:
- URL: `https://connect.clinicaschappo.com/api/webhook/360dialog`
- Verificacao: o endpoint GET responde ao `hub.verify_token`

---

## Troubleshooting

### Container nao inicia

```bash
docker compose logs connect-schappo | head -50
# Verificar se .env existe e tem as variaveis corretas
```

### Erro de conexao com banco

```bash
# Testar de dentro do container
docker exec connect-schappo wget -qO- http://localhost:3000/api/health
# Se database=error, verificar DATABASE_URL e host.docker.internal
```

### SSE nao funciona (eventos nao chegam)

Verificar que o Traefik tem os headers corretos:
```bash
curl -v https://connect.clinicaschappo.com/api/events 2>&1 | grep -i "cache-control\|x-accel"
# Deve mostrar: Cache-Control: no-cache e X-Accel-Buffering: no
```

### AMI desconectado

```bash
# Verificar se Asterisk esta acessivel do container
docker exec connect-schappo ping -c 2 host.docker.internal
# Verificar porta AMI
docker exec connect-schappo nc -z host.docker.internal 5038
```

---

## Imagem Docker

- Base: `node:20-alpine`
- Build: multi-stage (deps → build → runner)
- Output: Next.js standalone
- Timezone: `America/Sao_Paulo` (via `ENV TZ` + `apk add tzdata`)
- Tamanho: ~293MB
- Porta: 3000
- Usuario: nextjs (UID 1001, sem root)
