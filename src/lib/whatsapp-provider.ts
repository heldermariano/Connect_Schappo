import { extractUazapiMessageIds } from './types';
import type { SendResult } from './conversa-update';

// --- UAZAPI ---

export async function sendTextUAZAPI(
  number: string,
  text: string,
  instanceToken: string,
  mentions?: string[],
  replyId?: string,
): Promise<SendResult> {
  const url = process.env.UAZAPI_URL;
  if (!url || !instanceToken) return { success: false, error: 'UAZAPI nao configurado' };

  try {
    const payload: Record<string, unknown> = { number, text };
    if (mentions && mentions.length > 0) {
      payload.mentions = mentions.map(m => m.replace('@s.whatsapp.net', '').replace('@lid', '')).join(',');
    }
    if (replyId) payload.replyid = replyId;

    const res = await fetch(`${url}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[uazapi/text] Erro:', res.status, body, { number, replyid: replyId });
      return { success: false, error: `UAZAPI retornou ${res.status}` };
    }

    const data = await res.json();
    const ids = extractUazapiMessageIds(data);
    return { success: true, messageId: ids.shortId, fullMessageId: ids.fullId };
  } catch (err) {
    console.error('[uazapi/text] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com UAZAPI' };
  }
}

export async function sendMediaUAZAPI(
  number: string,
  mediaType: string,
  base64Data: string,
  mimetype: string,
  filename: string,
  instanceToken: string,
  caption?: string,
): Promise<SendResult> {
  const url = process.env.UAZAPI_URL;
  if (!url || !instanceToken) return { success: false, error: 'UAZAPI nao configurado' };

  try {
    const payload: Record<string, unknown> = {
      number,
      type: mediaType,
      file: `data:${mimetype};base64,${base64Data}`,
    };
    if (caption) payload.text = caption;
    if (mediaType === 'document') payload.docName = filename;

    const res = await fetch(`${url}/send/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[uazapi/media] Erro:', res.status, body);
      return { success: false, error: `UAZAPI retornou ${res.status}` };
    }

    const data = await res.json();
    const ids = extractUazapiMessageIds(data);
    return { success: true, messageId: ids.shortId, fullMessageId: ids.fullId };
  } catch (err) {
    console.error('[uazapi/media] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com UAZAPI' };
  }
}

export async function sendLocationUAZAPI(
  number: string,
  latitude: number,
  longitude: number,
  instanceToken: string,
  name?: string,
  address?: string,
): Promise<SendResult> {
  const url = process.env.UAZAPI_URL;
  if (!url || !instanceToken) return { success: false, error: 'UAZAPI nao configurado' };

  try {
    const payload: Record<string, unknown> = { number, latitude, longitude };
    if (name) payload.name = name;
    if (address) payload.address = address;

    const res = await fetch(`${url}/send/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[uazapi/location] Erro:', res.status, body);
      return { success: false, error: `UAZAPI retornou ${res.status}` };
    }

    const data = await res.json();
    const ids = extractUazapiMessageIds(data);
    return { success: true, messageId: ids.shortId, fullMessageId: ids.fullId };
  } catch (err) {
    console.error('[uazapi/location] Erro:', err);
    return { success: false, error: 'Erro de conexao com UAZAPI' };
  }
}

export async function sendContactUAZAPI(
  number: string,
  contactName: string,
  contactPhone: string,
  instanceToken: string,
): Promise<SendResult> {
  const url = process.env.UAZAPI_URL;
  if (!url || !instanceToken) return { success: false, error: 'UAZAPI nao configurado' };

  try {
    const res = await fetch(`${url}/send/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify({
        number,
        contact: [{
          name: { formatted_name: contactName, first_name: contactName },
          phones: [{ phone: contactPhone, type: 'CELL' }],
        }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[uazapi/contact] Erro:', res.status, body);
      return { success: false, error: `UAZAPI retornou ${res.status}` };
    }

    const data = await res.json();
    const ids = extractUazapiMessageIds(data);
    return { success: true, messageId: ids.shortId, fullMessageId: ids.fullId };
  } catch (err) {
    console.error('[uazapi/contact] Erro:', err);
    return { success: false, error: 'Erro de conexao com UAZAPI' };
  }
}

// --- 360Dialog ---

export async function sendText360Dialog(
  to: string,
  text: string,
): Promise<SendResult> {
  const url = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!url || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    const res = await fetch(`${url}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[360dialog/text] Erro:', res.status, body);
      return { success: false, error: `360Dialog retornou ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error('[360dialog/text] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com 360Dialog' };
  }
}

export async function sendMedia360Dialog(
  to: string,
  mediaType: string,
  fileBuffer: Buffer,
  filename: string,
  mimetype: string,
  caption?: string,
  isVoiceRecording?: boolean,
): Promise<SendResult> {
  const url = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!url || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    // Upload media
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimetype }), filename);
    formData.append('messaging_product', 'whatsapp');

    const uploadRes = await fetch(`${url}/media`, {
      method: 'POST',
      headers: { 'D360-API-KEY': apiKey },
      body: formData,
    });

    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      console.error('[360dialog/media] Upload erro:', uploadRes.status, body);
      return { success: false, error: `360Dialog upload retornou ${uploadRes.status}` };
    }

    const uploadData = await uploadRes.json();
    const mediaId = uploadData.id;
    if (!mediaId) {
      return { success: false, error: '360Dialog nao retornou media ID' };
    }

    // Send message with media
    const msgPayload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to,
      type: isVoiceRecording ? 'audio' : mediaType,
    };

    const mediaObj: Record<string, unknown> = { id: mediaId };
    if (caption && !isVoiceRecording && mediaType !== 'audio') {
      mediaObj.caption = caption;
    }
    if (mediaType === 'document') {
      mediaObj.filename = filename;
    }

    const msgType = isVoiceRecording ? 'audio' : mediaType;
    msgPayload[msgType] = mediaObj;

    const sendRes = await fetch(`${url}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify(msgPayload),
    });

    if (!sendRes.ok) {
      const body = await sendRes.text();
      console.error('[360dialog/media] Send erro:', sendRes.status, body);
      return { success: false, error: `360Dialog send retornou ${sendRes.status}` };
    }

    const data = await sendRes.json();
    return { success: true, messageId: data.messages?.[0]?.id, mediaId };
  } catch (err) {
    console.error('[360dialog/media] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com 360Dialog' };
  }
}

export async function sendLocation360Dialog(
  to: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string,
): Promise<SendResult> {
  const url = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!url || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    const location: Record<string, unknown> = { latitude, longitude };
    if (name) location.name = name;
    if (address) location.address = address;

    const res = await fetch(`${url}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'location',
        location,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[360dialog/location] Erro:', res.status, body);
      return { success: false, error: `360Dialog retornou ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error('[360dialog/location] Erro:', err);
    return { success: false, error: 'Erro de conexao com 360Dialog' };
  }
}

export async function sendContact360Dialog(
  to: string,
  contactName: string,
  contactPhone: string,
): Promise<SendResult> {
  const url = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!url || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    const res = await fetch(`${url}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'contacts',
        contacts: [{
          name: { formatted_name: contactName, first_name: contactName },
          phones: [{ phone: contactPhone, type: 'CELL' }],
        }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[360dialog/contact] Erro:', res.status, body);
      return { success: false, error: `360Dialog retornou ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error('[360dialog/contact] Erro:', err);
    return { success: false, error: 'Erro de conexao com 360Dialog' };
  }
}

export async function sendTemplate360Dialog(
  to: string,
  params: {
    nome_paciente: string;
    data: string;
    hora: string;
    nome_medico: string;
    procedimento: string;
  },
): Promise<SendResult> {
  const url = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!url || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    const res = await fetch(`${url}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: 'confirmacao_agendamento',
          language: { code: 'pt_BR' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: params.nome_paciente },
              { type: 'text', text: params.data },
              { type: 'text', text: params.hora },
              { type: 'text', text: params.nome_medico },
              { type: 'text', text: params.procedimento },
            ],
          }],
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[360dialog/template] Erro:', res.status, body);
      return { success: false, error: `360Dialog retornou ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error('[360dialog/template] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com 360Dialog' };
  }
}
