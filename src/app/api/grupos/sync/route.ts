import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { CATEGORIA_OWNER, getUazapiToken } from '@/lib/types';

/**
 * POST /api/grupos/sync — Sincroniza lista de grupos das instancias UAZAPI.
 * Chama POST {url}/group/list para cada instancia e faz upsert em atd.conversas.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const url = process.env.UAZAPI_URL;
  if (!url) {
    return NextResponse.json({ error: 'UAZAPI nao configurado' }, { status: 500 });
  }

  let totalSynced = 0;

  try {
    // Iterar pelas categorias UAZAPI (eeg, recepcao)
    for (const [categoria, owner] of Object.entries(CATEGORIA_OWNER)) {
      if (categoria === 'geral') continue; // 360Dialog nao tem API de grupos no mesmo formato

      const token = getUazapiToken(categoria);
      if (!token) continue;

      try {
        const res = await fetch(`${url}/group/list`, {
          method: 'POST',
          headers: {
            token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            force: true,
            noParticipants: true,
            pageSize: 1000,
          }),
        });

        if (!res.ok) {
          console.error(`[grupos/sync] Erro ao listar grupos ${categoria}:`, res.status);
          continue;
        }

        const data = await res.json();
        const groups = Array.isArray(data) ? data : data.groups || data.data || data.results || [];

        for (const group of groups) {
          const waChatId = group.id || group.jid || group.chatid;
          const nomeGrupo = group.subject || group.name || group.groupName || 'Grupo';

          if (!waChatId || !waChatId.includes('@g.us')) continue;

          // Upsert conversa tipo=grupo
          await pool.query(
            `SELECT atd.upsert_conversa($1, 'grupo', $2, 'uazapi', NULL, $3, NULL)`,
            [waChatId, categoria, nomeGrupo],
          );
          totalSynced++;
        }
      } catch (err) {
        console.error(`[grupos/sync] Erro na instancia ${categoria}:`, err);
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced });
  } catch (err) {
    console.error('[api/grupos/sync] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
