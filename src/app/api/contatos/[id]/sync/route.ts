import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

const UAZAPI_URL = process.env.UAZAPI_URL;

// Mapeamento owner → token da instância UAZAPI
const instanceTokens = (process.env.UAZAPI_INSTANCE_TOKENS || '').split(',').map(t => t.trim()).filter(Boolean);
const defaultToken = process.env.UAZAPI_TOKEN || '';
const OWNER_EEG = process.env.OWNER_EEG || '556192894339';
const OWNER_RECEPCAO = process.env.OWNER_RECEPCAO || '556183008973';

const OWNER_TOKENS: Record<string, string> = {};
if (instanceTokens.length >= 2) {
  OWNER_TOKENS[OWNER_EEG] = instanceTokens[0];
  OWNER_TOKENS[OWNER_RECEPCAO] = instanceTokens[1];
} else {
  OWNER_TOKENS[OWNER_EEG] = defaultToken;
  OWNER_TOKENS[OWNER_RECEPCAO] = defaultToken;
}

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
  description?: string;
  participants?: Array<{ id: string; admin?: string }>;
}

async function fetchChatDetails(number: string, token: string): Promise<ChatDetails | null> {
  try {
    const res = await fetch(`${UAZAPI_URL}/chat/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ number, preview: true }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * POST /api/contatos/[id]/sync — Sync on-demand de um contato/grupo via UAZAPI /chat/details.
 * [id] = telefone (individual) ou wa_chatid (grupo)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  if (!UAZAPI_URL) {
    return NextResponse.json({ error: 'UAZAPI nao configurada' }, { status: 500 });
  }

  const { id } = await params;
  const identifier = decodeURIComponent(id);

  try {
    // Buscar conversa pelo telefone ou wa_chatid
    const conversaResult = await pool.query(
      `SELECT id, wa_chatid, telefone, categoria, tipo, nome_contato, nome_grupo, avatar_url
       FROM atd.conversas
       WHERE telefone = $1 OR wa_chatid = $1
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`,
      [identifier],
    );

    if (conversaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const conv = conversaResult.rows[0];
    const isGroup = conv.tipo === 'grupo';

    // Determinar numero para lookup na UAZAPI
    let lookupNumber: string;
    if (isGroup) {
      lookupNumber = (conv.wa_chatid || '').replace('@g.us', '');
    } else {
      lookupNumber = (conv.telefone || conv.wa_chatid || '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
    }

    if (!lookupNumber || lookupNumber.length < 5) {
      return NextResponse.json({ error: 'Numero invalido para sync' }, { status: 400 });
    }

    // Tentar sync via cada instancia UAZAPI da categoria
    const owner = CATEGORIA_OWNER[conv.categoria];
    let token = owner ? OWNER_TOKENS[owner] : null;

    // Se nao encontrou token pela categoria, tentar todas as instancias
    if (!token) {
      token = instanceTokens[0] || defaultToken;
    }

    if (!token) {
      return NextResponse.json({ error: 'Token UAZAPI nao configurado' }, { status: 500 });
    }

    const details = await fetchChatDetails(lookupNumber, token);

    if (!details) {
      return NextResponse.json({ error: 'Nao foi possivel obter detalhes do contato' }, { status: 404 });
    }

    const newName = details.name || details.wa_name || details.wa_contactName || null;
    const newAvatar = details.imagePreview || details.image || null;
    const newPhone = details.phone || null;
    const memberCount = details.participants?.length || null;

    // Atualizar conversa
    const updates: string[] = [];
    const values: (string | null)[] = [];
    let idx = 1;

    if (isGroup) {
      if (newName) {
        updates.push(`nome_grupo = $${idx++}`);
        values.push(newName);
      }
    } else {
      if (newName) {
        updates.push(`nome_contato = $${idx++}`);
        values.push(newName);
      }
      if (newPhone && newPhone.length > 5) {
        updates.push(`telefone = $${idx++}`);
        values.push(newPhone);
      }
    }

    if (newAvatar && newAvatar.startsWith('http')) {
      updates.push(`avatar_url = $${idx++}`);
      values.push(newAvatar);
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      values.push(String(conv.id));
      await pool.query(
        `UPDATE atd.conversas SET ${updates.join(', ')} WHERE id = $${idx}`,
        values,
      );
    }

    // Atualizar tabela contatos se existe (individuais)
    if (!isGroup && newName) {
      const phoneClean = (conv.telefone || '').replace(/\D/g, '');
      if (phoneClean) {
        await pool.query(
          `UPDATE atd.contatos SET nome = $1, updated_at = NOW() WHERE telefone = $2`,
          [newName, phoneClean],
        );
      }
    }

    return NextResponse.json({
      nome: newName,
      telefone: newPhone || conv.telefone,
      avatar_url: newAvatar || conv.avatar_url,
      description: details.description || null,
      member_count: memberCount,
    });
  } catch (err) {
    console.error('[api/contatos/sync] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
