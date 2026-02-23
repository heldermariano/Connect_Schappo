# Guia de Configuracao — WebRTC Softphone via PJSIP

Configuracao do softphone WebRTC (ramal 250) no Issabel/Asterisk, coexistindo com ramais chan_sip (100-120).

---

## Contexto

O Connect Schappo integra um softphone WebRTC no browser via **SIP.js**. WebRTC exige **rtcp-mux** (RTCP multiplexado na mesma porta RTP), que **chan_sip nao suporta**. Por isso, o ramal 250 usa **PJSIP** com `webrtc=yes`, enquanto os demais ramais continuam em chan_sip.

### Problema resolvido

Sem PJSIP, o browser rejeitava o SDP do Asterisk com:
```
Failed to set remote answer sdp: The m= section with mid='0' is invalid.
RTCP-MUX is not enabled when it is required.
```

### Arquitetura de coexistencia

```
Browser (WebRTC/SIP.js)          Telefones IP / MicroSIP
        |                                |
    WSS:8089                          UDP:5060
        |                                |
   res_pjsip                         chan_sip
   (ramal 250)                    (ramais 100-120)
        |                                |
        └──────── Asterisk 16 ───────────┘
                     |
              simple_bridge
            (transcodificacao automatica)
```

---

## Pre-requisitos

- Issabel 4 com Asterisk 16.x
- HTTP server habilitado no Asterisk (porta 8089)
- Certificado TLS para WebSocket Secure (wss)
- Modulos PJSIP carregados (`autoload=yes`)

### Verificar HTTP server

```bash
asterisk -rx "http show status"
```

Deve mostrar porta 8089 habilitada. Se nao, editar `/etc/asterisk/http.conf`:
```ini
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8089
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/asterisk/keys/asterisk.pem
tlsprivatekey=/etc/asterisk/keys/asterisk.pem
```

---

## Passo 1 — Preload PJSIP (modules.conf)

**CRITICO**: Sem preload, chan_sip registra o handler WebSocket primeiro e `res_pjsip_transport_websocket.so` fica "Not Running".

Editar `/etc/asterisk/modules.conf`, adicionar **apos** os preloads existentes:

```ini
preload => pbx_config.so
preload => chan_local.so
preload => res_pjsip.so
preload => res_pjsip_transport_websocket.so
```

### Verificacao

```bash
asterisk -rx "module show like pjsip_transport_websocket"
```

Deve mostrar `Status: Running`. Se mostrar "Not Running", os preloads nao estao sendo aplicados.

---

## Passo 2 — Configurar PJSIP (pjsip_custom.conf)

Editar `/etc/asterisk/pjsip_custom.conf`:

```ini
; --- Auth ---
[auth250]
type=auth
auth_type=userpass
username=250
password=Schappo250

; --- AOR (Address of Record) ---
[250]
type=aor
max_contacts=5
remove_existing=yes
qualify_frequency=30

; --- Endpoint WebRTC ---
[250]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw
webrtc=yes
direct_media=no
auth=auth250
aors=250
callerid="Connect Schappo" <250>
dtmf_mode=rfc4733
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
dtls_verify=no
```

### Parametros importantes

| Parametro | Valor | Motivo |
|---|---|---|
| `webrtc=yes` | Ativa rtcp_mux, ice, avpf, dtls, bundle | Obrigatorio para WebRTC |
| `direct_media=no` | Asterisk faz bridge de media | WebRTC (DTLS-SRTP) nao fala direto com chan_sip (plain RTP) |
| `dtls_verify=no` | Nao valida certificado DTLS | Certs auto-gerados podem falhar verificacao |
| `rtp_symmetric=yes` | Envia RTP de volta para IP recebido | Necessario para NAT/VPN |
| `force_rport=yes` | Usa porta real do NAT | Traversal NAT |
| `rewrite_contact=yes` | Reescreve Contact com IP real | Traversal NAT |
| `allow=ulaw,alaw` | Sem opus (opcional) | Opus funciona se `codec_opus.so` estiver carregado |

### O que `webrtc=yes` configura automaticamente

- `use_avpf=yes`
- `media_encryption=dtls`
- `dtls_auto_generate_cert=yes`
- `ice_support=yes`
- `rtcp_mux=yes`
- `media_use_received_transport=yes`
- `bundle=yes`

### NAO definir transport

O WebSocket e gerenciado pelo HTTP server do Asterisk, nao por uma secao `[transport]` no PJSIP. Definir `[transport-wss]` causa erro:
```
ERROR: Unable to retrieve PJSIP transport 'transport-wss'
```

---

## Passo 3 — Remover ramal 250 do chan_sip

Editar `/etc/asterisk/sip_custom.conf`, manter apenas:

```ini
[general](+)
stunaddr=stun.l.google.com:19302
```

Remover qualquer secao `[250]` que existia no chan_sip.

---

## Passo 4 — Restart e verificacao

```bash
# Restart completo (obrigatorio para preloads e transports)
asterisk -rx "core restart now"

# Verificar WebSocket transport
asterisk -rx "module show like pjsip_transport_websocket"
# Esperado: Running

# Verificar endpoint 250
asterisk -rx "pjsip show endpoint 250"
# Esperado: webrtc=yes, rtcp_mux=true, direct_media=false

# Verificar ramais chan_sip (100-120 devem continuar funcionando)
asterisk -rx "sip show peers"
# Esperado: ramais 100-120 online, SEM o 250

# Verificar transports disponiveis
asterisk -rx "pjsip show transports"
# Esperado: transport-wss tipo wss
```

---

## Passo 5 — Configurar softphone no Connect Schappo

Na interface do Connect Schappo, clicar no icone de engrenagem do softphone:

| Campo | Valor |
|---|---|
| Servidor SIP | `10.150.77.91` |
| Porta | `8089` |
| Transporte | `wss` |
| Usuario | `250` |
| Senha | `Schappo250` |

### Permissoes do browser

**IMPORTANTE**: O browser precisa de permissao para microfone. Se o audio nao funcionar:
1. Verificar permissoes em `chrome://settings/content/microphone`
2. Garantir que o site tem permissao de microfone
3. Testar com `navigator.mediaDevices.getUserMedia({audio: true})`

---

## Troubleshooting

### Registro falha (401 Authentication)

```bash
# Verificar auth configurado
asterisk -rx "pjsip show auth auth250"

# Verificar logs SIP
asterisk -rx "pjsip set logger on"
```

- Confirmar que `pjsip_custom.conf` tem a secao `[auth250]`
- Confirmar que a senha no browser confere com a senha no config
- Confirmar que nao existe `[250]` no `sip_custom.conf` (conflito)

### WebSocket fecha (code: 1006)

- Verificar se Fail2Ban nao baniu o IP: `fail2ban-client status asterisk`
- Verificar whitelist: `/etc/fail2ban/jail.local` → `ignoreip`
- Desbannir: `fail2ban-client unban --all`
- Verificar certificado TLS do HTTP server

### Chamada sem audio

1. **Permissao do browser**: Chrome bloqueia microfone sem permissao
2. **Verificar ICE**: No console (F12), procurar `[SIP] ICE connectionState: connected`
3. **Verificar tracks**: No console, executar:
   ```javascript
   const audio = document.getElementById('sip-remote-audio');
   console.log({paused: audio.paused, volume: audio.volume, muted: audio.muted});
   ```
4. **RTP debug no Asterisk**:
   ```bash
   asterisk -rx "rtp set debug on"
   # Fazer ligacao e verificar se pacotes fluem nos dois sentidos
   ```
5. **Codec opus nao disponivel**: Verificar `asterisk -rx "module show like opus"`. Se nao tiver, usar `allow=ulaw,alaw` (sem opus)

### Chamada cai imediatamente apos atender

- **Causa**: chan_sip lidando com WebSocket (sem rtcp-mux)
- **Solucao**: Verificar preloads no `modules.conf` e reiniciar Asterisk
- **Verificar**: `asterisk -rx "module show like pjsip_transport_websocket"` deve mostrar "Running"

### pjsip reload nao funciona

Transports PJSIP so sao criados no startup. Qualquer mudanca de transport exige:
```bash
asterisk -rx "core restart now"
```

Para mudancas apenas em endpoints/auth/aor, `pjsip reload` funciona.

### Fail2Ban bane IP repetidamente

Adicionar IPs/redes internas ao whitelist:
```ini
# /etc/fail2ban/jail.local
[DEFAULT]
ignoreip = 127.0.0.1/8 10.150.77.0/24 10.0.8.0/24
```

```bash
systemctl restart fail2ban
```

---

## Comandos uteis

```bash
# Status geral
asterisk -rx "pjsip show endpoints"
asterisk -rx "pjsip show endpoint 250"
asterisk -rx "sip show peers"

# Debug
asterisk -rx "pjsip set logger on"       # Logs SIP
asterisk -rx "rtp set debug on"          # Logs RTP
asterisk -rx "core set verbose 5"        # Logs detalhados

# Desativar debug
asterisk -rx "pjsip set logger off"
asterisk -rx "rtp set debug off"

# Canais ativos
asterisk -rx "core show channels verbose"

# Codecs
asterisk -rx "core show codecs"
asterisk -rx "module show like opus"
```

---

## Historico de decisoes

1. **chan_sip primeiro, falhou**: chan_sip nao suporta `rtcp-mux`, obrigatorio para WebRTC
2. **PJSIP websocket "Not Running"**: chan_sip registrava handler WebSocket primeiro → resolvido com `preload`
3. **Transport WSS nao cria**: WebSocket PJSIP usa HTTP server, nao secao `[transport]` → removida
4. **Audio mudo**: Permissao de microfone do browser nao concedida → solicitar permissao
5. **Fail2Ban bloqueia**: Multiplas tentativas de registro disparam ban → whitelist IPs internos/VPN
