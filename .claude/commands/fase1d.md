Leia o arquivo CLAUDE.md na raiz do projeto para entender o contexto completo.

A **Fase 1D — Canal WhatsApp Voz** envolve configurações no servidor de PRODUÇÃO.

Gere arquivos de configuração em `config/`:

1. `config/pjsip-whatsapp.conf` — PJSIP para Asterisk (TLS 5061, endpoint 556133455701, codec opus)
2. `config/extensions-whatsapp.conf` — dialplan [from-whatsapp] com Queue e VoiceMail
3. `config/360dialog-calling-settings.json` — payload Calling API (horários seg-sex 07-19, sáb 08-12)
4. `config/firewall-rules.sh` — abrir portas 5061/tcp e 10000-20000/udp
5. `config/certbot-asterisk.sh` — copiar certificados TLS para Asterisk
6. `docs/GUIA_DEPLOY_WHATSAPP_VOZ.md` — guia passo a passo

Commit e push. Responda em português.
