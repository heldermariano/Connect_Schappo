import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const UAZAPI_URL = process.env.UAZAPI_URL;
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN;

// Owners UAZAPI para sincronizar
const UAZAPI_OWNERS = [
  process.env.OWNER_EEG || '556192894339',
  process.env.OWNER_RECEPCAO || '556183008973',
];

interface UazapiChat {
  wa_chatid?: string;
  phone?: string;
  name?: string;
  wa_name?: string;
  wa_contactName?: string;
  imagePreview?: string;
  wa_isGroup?: boolean;
}

/**
 * POST /api/contatos/sync — Sincroniza fotos de contato via UAZAPI /chat/find.
 * Para cada owner UAZAPI, busca chats com paginacao e atualiza avatar_url
 * em atd.conversas e atd.participantes_grupo.
 */
export async function POST() {
  if (!UAZAPI_URL || !UAZAPI_TOKEN) {
    return NextResponse.json(
      { error: 'UAZAPI nao configurada' },
      { status: 500 },
    );
  }

  let totalFetched = 0;
  let totalUpdated = 0;

  try {
    for (const owner of UAZAPI_OWNERS) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const url = `${UAZAPI_URL}/chat/find?token=${UAZAPI_TOKEN}&owner=${owner}&page=${page}&limit=100`;

        const res = await fetch(url, {
          method: 'GET',
          headers: { token: UAZAPI_TOKEN },
        });

        if (!res.ok) {
          console.error(`[sync] Erro ao buscar chats owner=${owner} page=${page}: ${res.status}`);
          break;
        }

        const data = await res.json();
        const chats: UazapiChat[] = Array.isArray(data) ? data : (data.chats || data.data || []);

        if (chats.length === 0) {
          hasMore = false;
          break;
        }

        totalFetched += chats.length;

        for (const chat of chats) {
          const avatarUrl = chat.imagePreview;
          if (!avatarUrl || !avatarUrl.startsWith('http')) continue;

          const waChatid = chat.wa_chatid;
          const phone = chat.phone;
          const nome = chat.name || chat.wa_name || chat.wa_contactName || null;

          // Atualizar avatar em conversas
          if (waChatid) {
            const convResult = await pool.query(
              `UPDATE atd.conversas SET avatar_url = $1, updated_at = NOW()
               WHERE wa_chatid = $2 AND (avatar_url IS NULL OR avatar_url = '')
               RETURNING id`,
              [avatarUrl, waChatid],
            );
            totalUpdated += convResult.rowCount || 0;
          }

          // Atualizar avatar em participantes_grupo (por telefone)
          if (phone && phone.length > 5) {
            const phoneWa = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
            const partResult = await pool.query(
              `UPDATE atd.participantes_grupo SET
                avatar_url = $1,
                nome_whatsapp = CASE
                  WHEN $3 IS NOT NULL AND $3 != '' AND (nome_whatsapp IS NULL OR nome_whatsapp = '')
                  THEN $3 ELSE nome_whatsapp
                END,
                atualizado_at = NOW()
               WHERE wa_phone = $2 AND (avatar_url IS NULL OR avatar_url = '')
               RETURNING id`,
              [avatarUrl, phoneWa, nome],
            );
            totalUpdated += partResult.rowCount || 0;
          }
        }

        // Se retornou menos que o limit, nao tem mais paginas
        if (chats.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    return NextResponse.json({ fetched: totalFetched, updated: totalUpdated });
  } catch (err) {
    console.error('[api/contatos/sync] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
