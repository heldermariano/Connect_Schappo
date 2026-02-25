import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const UAZAPI_URL = process.env.UAZAPI_URL;

// Mapeamento owner → token da instância UAZAPI
const OWNER_TOKENS: Record<string, string> = {};
const instanceTokens = (process.env.UAZAPI_INSTANCE_TOKENS || '').split(',').map(t => t.trim()).filter(Boolean);
const defaultToken = process.env.UAZAPI_TOKEN || '';

// Mapear tokens por owner (EEG=token1, Recepcao=token2)
const OWNER_EEG = process.env.OWNER_EEG || '556192894339';
const OWNER_RECEPCAO = process.env.OWNER_RECEPCAO || '556183008973';
if (instanceTokens.length >= 2) {
  OWNER_TOKENS[OWNER_EEG] = instanceTokens[0];
  OWNER_TOKENS[OWNER_RECEPCAO] = instanceTokens[1];
} else {
  OWNER_TOKENS[OWNER_EEG] = defaultToken;
  OWNER_TOKENS[OWNER_RECEPCAO] = defaultToken;
}

// Mapeamento categoria → owner
const CATEGORIA_OWNER: Record<string, string> = {
  eeg: OWNER_EEG,
  recepcao: OWNER_RECEPCAO,
};

interface ChatDetails {
  name?: string;
  wa_name?: string;
  wa_contactName?: string;
  image?: string;
  imagePreview?: string;
  phone?: string;
  wa_chatid?: string;
}

/**
 * Busca detalhes de um contato via UAZAPI /chat/details
 */
async function fetchChatDetails(phone: string, token: string): Promise<ChatDetails | null> {
  try {
    const res = await fetch(`${UAZAPI_URL}/chat/details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token,
      },
      body: JSON.stringify({ number: phone, preview: true }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * POST /api/contatos/sync — Sincroniza nome e foto de contatos via UAZAPI /chat/details.
 * Para cada conversa individual, busca detalhes do contato e atualiza nome_contato e avatar_url.
 *
 * Query params:
 *   force=true — atualiza mesmo quem já tem nome/foto
 *   categoria=eeg|recepcao — sincronizar apenas um canal
 */
export async function POST(request: Request) {
  if (!UAZAPI_URL) {
    return NextResponse.json({ error: 'UAZAPI nao configurada' }, { status: 500 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get('force') === 'true';
  const categoriaFilter = url.searchParams.get('categoria');

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  try {
    // Buscar conversas individuais que precisam de atualização
    const conditions = ['c.is_archived = FALSE'];
    const values: string[] = [];
    let paramIdx = 1;

    if (categoriaFilter) {
      conditions.push(`c.categoria = $${paramIdx++}`);
      values.push(categoriaFilter);
    } else {
      conditions.push(`c.categoria IN ('eeg', 'recepcao')`);
    }

    if (!force) {
      conditions.push(`(c.nome_contato IS NULL OR c.nome_contato = '' OR c.nome_grupo IS NULL OR c.nome_grupo = '' OR c.avatar_url IS NULL OR c.avatar_url = '')`);
    }

    const result = await pool.query(
      `SELECT c.id, c.wa_chatid, c.telefone, c.categoria, c.tipo, c.nome_contato, c.nome_grupo, c.avatar_url
       FROM atd.conversas c
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.ultima_msg_at DESC NULLS LAST`,
      values,
    );

    const conversas = result.rows;
    console.log(`[sync] Iniciando sync de ${conversas.length} conversas (force=${force})`);

    for (const conv of conversas) {
      const isGroup = conv.tipo === 'grupo';

      // Para grupos: usar wa_chatid (ex: 556191495059-1566600219@g.us)
      // Para individuais: usar telefone limpo
      let lookupNumber: string;
      if (isGroup) {
        lookupNumber = (conv.wa_chatid || '').replace('@g.us', '');
        if (!lookupNumber) continue;
      } else {
        lookupNumber = (conv.telefone || conv.wa_chatid || '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
        if (!lookupNumber || lookupNumber.length < 8) continue;
      }

      const owner = CATEGORIA_OWNER[conv.categoria];
      const token = OWNER_TOKENS[owner];
      if (!token) continue;

      const details = await fetchChatDetails(lookupNumber, token);
      totalProcessed++;

      if (!details) {
        totalErrors++;
        continue;
      }

      const newName = details.name || details.wa_name || details.wa_contactName || null;
      const newAvatar = details.imagePreview || details.image || null;
      const newPhone = details.phone || null;

      const updates: string[] = [];
      const updateValues: (string | null)[] = [];
      let idx = 1;

      if (isGroup) {
        // Grupos: atualizar nome_grupo
        if (newName && (force || !conv.nome_grupo)) {
          updates.push(`nome_grupo = $${idx++}`);
          updateValues.push(newName);
        }
      } else {
        // Individuais: atualizar nome_contato
        if (newName && (force || !conv.nome_contato)) {
          updates.push(`nome_contato = $${idx++}`);
          updateValues.push(newName);
        }
        // Atualizar telefone formatado se disponível
        if (newPhone && newPhone.length > 5) {
          updates.push(`telefone = $${idx++}`);
          updateValues.push(newPhone);
        }
      }

      // Avatar para ambos
      if (newAvatar && newAvatar.startsWith('http') && (force || !conv.avatar_url)) {
        updates.push(`avatar_url = $${idx++}`);
        updateValues.push(newAvatar);
      }

      if (updates.length === 0) continue;

      updates.push('updated_at = NOW()');
      updateValues.push(String(conv.id));

      await pool.query(
        `UPDATE atd.conversas SET ${updates.join(', ')} WHERE id = $${idx}`,
        updateValues,
      );
      totalUpdated++;

      // Atualizar tabela contatos se existir registro com mesmo telefone (individuais)
      if (!isGroup && newName) {
        const phoneClean = (conv.telefone || '').replace(/\D/g, '');
        if (phoneClean) {
          await pool.query(
            `UPDATE atd.contatos SET nome = $1 WHERE telefone = $2 AND (nome IS NULL OR nome = '')`,
            [newName, phoneClean],
          );
        }
      }

      // Rate limit: 100ms entre requisições
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[sync] Concluido: ${totalProcessed} processados, ${totalUpdated} atualizados, ${totalErrors} erros`);

    return NextResponse.json({
      processed: totalProcessed,
      updated: totalUpdated,
      errors: totalErrors,
    });
  } catch (err) {
    console.error('[api/contatos/sync] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
