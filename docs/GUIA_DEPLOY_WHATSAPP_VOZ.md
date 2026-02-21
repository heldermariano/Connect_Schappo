# Guia de Deploy — WhatsApp Voz (Fase 1D)

Passo a passo para configurar chamadas de voz via WhatsApp no numero **556133455701** (360Dialog) usando SIP + Issabel/Asterisk.

---

## Pre-requisitos

- Servidor Issabel/Asterisk com PJSIP habilitado
- Numero 556133455701 ativo no 360Dialog (Cloud API)
- Dominio `connect.clinicaschappo.com` com DNS apontando para o servidor
- Certificado TLS (Let's Encrypt) para o dominio
- Acesso root ao servidor de producao

---

## 1. Verificar Tier no WhatsApp Business Manager

1. Acessar [business.facebook.com](https://business.facebook.com)
2. Ir em **WhatsApp Accounts** > selecionar a conta
3. Em **Phone Numbers**, verificar o tier do numero 556133455701
4. **Calling API requer tier Standard ou superior**
5. Se necessario, solicitar upgrade do tier ao 360Dialog

---

## 2. Certificados TLS

```bash
# Gerar certificado (se ainda nao existe)
certbot certonly --standalone -d connect.clinicaschappo.com

# Copiar para o Asterisk
sudo bash config/certbot-asterisk.sh
```

Agendar renovacao automatica:
```bash
sudo crontab -e
# Adicionar:
0 3 * * * certbot renew --quiet --deploy-hook '/caminho/config/certbot-asterisk.sh'
```

---

## 3. Firewall

```bash
sudo bash config/firewall-rules.sh
```

Portas necessarias:
- **5061/tcp** — SIP TLS (comunicacao com SBC 360Dialog)
- **10000-20000/udp** — RTP (audio das chamadas)

---

## 4. Configurar PJSIP no Asterisk

Copiar configuracao:
```bash
sudo cp config/pjsip-whatsapp.conf /etc/asterisk/pjsip_whatsapp.conf
```

Editar `/etc/asterisk/pjsip.conf` e adicionar no final:
```ini
#include pjsip_whatsapp.conf
```

**IMPORTANTE**: Substituir os valores no arquivo:
- `SUBSTITUIR_PELA_SENHA_360DIALOG` → senha fornecida pelo 360Dialog
- Verificar que os paths dos certificados estao corretos

Recarregar:
```bash
asterisk -rx "pjsip reload"
asterisk -rx "pjsip show endpoints"   # Deve mostrar 360dialog-whatsapp
```

---

## 5. Configurar Dialplan

Copiar configuracao:
```bash
sudo cp config/extensions-whatsapp.conf /etc/asterisk/extensions_whatsapp.conf
```

Editar `/etc/asterisk/extensions.conf` e adicionar:
```ini
#include extensions_whatsapp.conf
```

Recarregar:
```bash
asterisk -rx "dialplan reload"
asterisk -rx "dialplan show from-whatsapp"   # Deve mostrar o contexto
```

### Fila de atendimento

Editar `/etc/asterisk/queues.conf` e adicionar:
```ini
[fila-recepcao]
strategy=ringall
timeout=15
retry=5
maxlen=10
joinempty=yes
leavewhenempty=no
ringinuse=no
member => PJSIP/201
member => PJSIP/202
member => PJSIP/203
member => PJSIP/204
```

Recarregar:
```bash
asterisk -rx "queue reload all"
```

### Audios personalizados (opcional)

Criar arquivos de audio em `/var/lib/asterisk/sounds/custom/`:
- `boas-vindas-whatsapp.wav` — "Clinica Schappo, em que posso ajudar?"
- `fora-horario.wav` — "Nosso horario de atendimento e de segunda a sexta, das 7h as 19h, e sabado das 8h ao meio-dia."
- `voicemail-whatsapp.wav` — "Nao foi possivel atender. Deixe sua mensagem."

Formato: WAV, 8kHz, 16-bit, mono (ou usar `sox` para converter).

---

## 6. Habilitar Calling no 360Dialog

Enviar requisicao para a API do 360Dialog:

```bash
curl -X POST https://waba-v2.360dialog.io/configs/calling \
  -H "D360-API-KEY: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "calling": {
      "enabled": true,
      "sip": {
        "uri": "sip:556133455701@IP_SERVIDOR:5061;transport=tls",
        "username": "556133455701",
        "password": "SENHA_CONFIGURADA_NO_PJSIP"
      }
    }
  }'
```

Referencia completa do payload: `config/360dialog-calling-settings.json`

**Substituir**:
- `SUA_API_KEY` → API key do 360Dialog
- `IP_SERVIDOR` → IP publico do servidor de producao
- `SENHA_CONFIGURADA_NO_PJSIP` → mesma senha do pjsip_whatsapp.conf

---

## 7. Testar Chamada Inbound

1. Ligar de um celular para o numero **+55 61 3345-5701** via WhatsApp
2. Verificar no CLI do Asterisk:
   ```bash
   asterisk -rvvv
   # Deve aparecer: CHAMADA WHATSAPP VOZ, De: NUMERO, Para: EXTEN
   ```
3. Verificar que os ramais tocam (fila-recepcao)
4. Atender e confirmar audio bidirecional
5. Verificar log na plataforma Connect Schappo (`/chamadas`)

### Troubleshooting

```bash
# Verificar status do endpoint PJSIP
asterisk -rx "pjsip show endpoint 360dialog-whatsapp"

# Verificar registros SIP
asterisk -rx "pjsip show registrations"

# Logs detalhados
asterisk -rx "pjsip set logger on"
tail -f /var/log/asterisk/full

# Testar conectividade TLS
openssl s_client -connect sbc.360dialog.io:5061

# Verificar portas abertas
ss -tlnp | grep 5061
ss -ulnp | grep -E '1[0-9]{4}|20000'
```

---

## Resumo do fluxo

```
Celular (WhatsApp) ──> 360Dialog SBC ──TLS/5061──> Asterisk
                                                      |
                                                 [from-whatsapp]
                                                      |
                                          ┌───────────┼───────────┐
                                          │     Horario OK?       │
                                          ├─── Sim ──>  Queue     │
                                          │            (201-204)  │
                                          ├─── Nao ──>  Voicemail │
                                          └───────────────────────┘
```

---

## Horarios de atendimento

| Dia | Horario |
|-----|---------|
| Segunda a Sexta | 07:00 - 19:00 |
| Sabado | 08:00 - 12:00 |
| Domingo/Feriado | Voicemail |
