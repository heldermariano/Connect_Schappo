# Softphone e Telefonia
> Usar quando: softphone, SIP/WebRTC, DTMF, ramais, log chamadas, click-to-call, AMI, config PJSIP

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/components/softphone/Softphone.tsx` | Painel softphone completo |
| `src/components/softphone/DialPad.tsx` | Teclado numerico (DTMF Web Audio) |
| `src/components/softphone/CallDisplay.tsx` | Display chamada |
| `src/components/softphone/CallControls.tsx` | Mute, hold, DTMF |
| `src/components/softphone/SipStatus.tsx` | Indicador registro SIP |
| `src/components/softphone/SipSettings.tsx` | Config SIP (modal overlay) |
| `src/components/softphone/RamaisList.tsx` | Ramais online 100-120 (refresh 15s) |
| `src/components/calls/CallLog.tsx` | Historico chamadas |
| `src/components/calls/CallItem.tsx` | Item chamada |
| `src/components/calls/CallAlert.tsx` | Alerta chamada ativa |
| `src/components/calls/CallButton.tsx` | Botao ligar |
| `src/hooks/useSipPhone.ts` | SIP completo: register, call, hold, mute, DTMF |
| `src/hooks/useChamadas.ts` | Fetch + filtro chamadas |
| `src/lib/ami-listener.ts` | Asterisk AMI lifecycle |
| `src/lib/sip-config.ts` | AES-256-GCM encrypt/decrypt SIP passwords |
| `src/app/api/calls/originate/route.ts` | Click-to-call via AMI |
| `src/app/api/chamadas/route.ts` | GET: log chamadas |
| `src/app/api/ramais/route.ts` | GET: ramais online (100-120) |
| `src/app/api/atendentes/sip/route.ts` | GET/PUT: config SIP |

---

## Arquitetura PJSIP/WebRTC

| Componente | Driver | Transporte |
|---|---|---|
| Ramais 100-120 (telefones/MicroSIP) | chan_sip | UDP (porta 5060) |
| Ramal 250 (WebRTC geral) | PJSIP | WSS (porta 8089) |
| Ramais 251-259 (WebRTC individuais) | PJSIP | WSS (porta 8089) |
| Trunks telefonia | chan_sip | UDP |

**Servidor**: `10.150.77.91` (Issabel 4, Asterisk 16.21.1)

### Config PJSIP (`/etc/asterisk/pjsip_custom.conf`)

```ini
[auth250]
type=auth
auth_type=userpass
username=250
password=Schappo250

[250]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw
webrtc=yes
direct_media=no
auth=auth250
aors=250
dtmf_mode=rfc4733
dtls_verify=no
```

`webrtc=yes` ativa: `rtcp_mux`, `ice_support`, `use_avpf`, `media_encryption=dtls`, `dtls_auto_generate_cert`, `bundle`.

### Por que PJSIP (nao chan_sip)

WebRTC exige `rtcp-mux`. chan_sip nao suporta. Sem isso: `"RTCP-MUX is not enabled when it is required"`.

### Preload Obrigatorio (`modules.conf`)

```ini
preload => res_pjsip.so
preload => res_pjsip_transport_websocket.so
```

Sem preload, chan_sip registra handler WebSocket primeiro e PJSIP fica "Not Running".

---

## AMI (Asterisk Manager Interface)

- **Host**: `AMI_HOST:5038` | **Auth**: `AMI_USER`/`AMI_PASSWORD`
- Lib: `asterisk-manager` npm
- Lifecycle: `Newchannel → DialBegin → BridgeEnter → Hangup`
- Origem: `from-whatsapp` = whatsapp, `from-external` = telefone

---

## API Routes

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/calls/originate` | POST | Click-to-call via AMI |
| `/api/chamadas` | GET | Log com filtros (origem, status) |
| `/api/ramais` | GET | Ramais online (100-120) via AMI |
| `/api/atendentes/sip` | GET/PUT | Config SIP (password AES-256-GCM encrypted) |

---

## Banco de Dados

### Tabela `atd.chamadas`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | SERIAL PK | |
| conversa_id | FK | |
| origem | TEXT | 'whatsapp', 'telefone' |
| direcao | TEXT | 'entrada', 'saida' |
| caller_number | TEXT | |
| called_number | TEXT | |
| status | TEXT | 'ringing', 'answered', 'missed', 'busy' |
| duracao_seg | INTEGER | |
| asterisk_id | TEXT | |

### Campos SIP em `atd.atendentes`

`sip_server`, `sip_port`, `sip_transport`, `sip_username`, `sip_password_encrypted`, `sip_enabled`

---

## Regras

1. **Softphone: dynamic import, ssr: false** — sip.js usa APIs browser
2. **DTMF via Web Audio API** — Tons reais no teclado
3. **Senhas SIP** — AES-256-GCM com `SIP_ENCRYPTION_KEY`
4. **Ramais individuais 251-259** — Um por operador, campo `sip_enabled` em atendentes
5. **Config SIP no frontend** — Modal overlay (SipSettings.tsx)

## SSE Events Relacionados

`chamada_nova`, `chamada_atualizada`, `ramal_status` — ver skill `sse-realtime`
