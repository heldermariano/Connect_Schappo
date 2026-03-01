-- 017_sip_webrtc_operadores.sql
-- Configura ramais PJSIP WebRTC individuais (251-259) para cada operador
-- Permite auto-registro SIP no login do Connect Schappo

-- Helder (id=5) → ramal PJSIP 251, ramal fisico 105
UPDATE atd.atendentes SET
  sip_server = '10.150.77.91',
  sip_port = 8089,
  sip_transport = 'wss',
  sip_username = '251',
  sip_password_encrypted = '7fafb535402eb4a443eb48ce42402a43:cae477ae0a405e47ab87572a297e867a:9c1ed30e33d657a6468078',
  sip_enabled = true,
  ramal = '105'
WHERE id = 5;

-- Daiany (id=6) → ramal PJSIP 252, ramal fisico 103
UPDATE atd.atendentes SET
  sip_server = '10.150.77.91',
  sip_port = 8089,
  sip_transport = 'wss',
  sip_username = '252',
  sip_password_encrypted = 'c16cfd4f6af283740c0c4b2ba8306e36:97af8bdc1a590d6eff4e76653a445e0f:3969567dc8ac227aaf455f',
  sip_enabled = true,
  ramal = '103'
WHERE id = 6;

-- Evillyn (id=7) → ramal PJSIP 253
UPDATE atd.atendentes SET
  sip_server = '10.150.77.91',
  sip_port = 8089,
  sip_transport = 'wss',
  sip_username = '253',
  sip_password_encrypted = '8315bd7ff93770ef213c53da879fe8fd:07939abb34aa7a1cad4d3413e591fbb3:0b127a7b412ac553910ebd',
  sip_enabled = true
WHERE id = 7;

-- Gizelle (id=8) → ramal PJSIP 254, ramal fisico 101
UPDATE atd.atendentes SET
  sip_server = '10.150.77.91',
  sip_port = 8089,
  sip_transport = 'wss',
  sip_username = '254',
  sip_password_encrypted = 'a8350ed59fd048eee5cdd01f30d2fb92:ca768f250fa40b1486be57fa479051b1:2343cc4109b96cf11fe828',
  sip_enabled = true,
  ramal = '101'
WHERE id = 8;

-- Janaina (id=9) → ramal PJSIP 255, ramal fisico 102
UPDATE atd.atendentes SET
  sip_server = '10.150.77.91',
  sip_port = 8089,
  sip_transport = 'wss',
  sip_username = '255',
  sip_password_encrypted = '5f9791d0ec3155783c58f3fb9d48357f:043de5a6eb229e6c19f1589fc68fe394:2458f3c8fd8cdb0363edfa',
  sip_enabled = true,
  ramal = '102'
WHERE id = 9;

-- Luana (id=10) → ramal PJSIP 256, ramal fisico 100
UPDATE atd.atendentes SET
  sip_server = '10.150.77.91',
  sip_port = 8089,
  sip_transport = 'wss',
  sip_username = '256',
  sip_password_encrypted = '53386a1e14455dd629eb0ec9e53e0b35:d8e388c54ace0150a84aec5ec638b7c6:6657dd9ef0ee8519822c34',
  sip_enabled = true,
  ramal = '100'
WHERE id = 10;

-- Alice (id=11) → ramal PJSIP 257
UPDATE atd.atendentes SET
  sip_server = '10.150.77.91',
  sip_port = 8089,
  sip_transport = 'wss',
  sip_username = '257',
  sip_password_encrypted = '93d3625154e819468eeecb35a6038833:92bdfcff7b2d16e6d555672cbdd57fce:0fb7d812ffba72ecbc873c',
  sip_enabled = true
WHERE id = 11;

-- Ana Thayna (id=12) → ramal PJSIP 258
UPDATE atd.atendentes SET
  sip_server = '10.150.77.91',
  sip_port = 8089,
  sip_transport = 'wss',
  sip_username = '258',
  sip_password_encrypted = 'd60e826c970d46dbda01265c34a0539d:52d1acaf5d5d522da21f7e45d15d1d18:6acb2500f57f5b0995d98c',
  sip_enabled = true
WHERE id = 12;

-- Danielle (id=13) → ramal PJSIP 259
UPDATE atd.atendentes SET
  sip_server = '10.150.77.91',
  sip_port = 8089,
  sip_transport = 'wss',
  sip_username = '259',
  sip_password_encrypted = 'a9e3a99f56ab02b865b5a407d14d5117:d1d5a19113f48ccb4cd22634b76cddad:4fc004a70766dc32e997b7',
  sip_enabled = true
WHERE id = 13;
