import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const { chatId } = await params;

  if (!chatId) {
    return NextResponse.json({ error: 'chatId obrigatorio' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT wa_phone AS phone,
              COALESCE(nome_salvo, nome_whatsapp, wa_phone) AS nome,
              avatar_url,
              wa_lid AS lid
       FROM atd.participantes_grupo
       WHERE wa_chatid = $1
       ORDER BY COALESCE(nome_salvo, nome_whatsapp, wa_phone) ASC`,
      [chatId],
    );

    return NextResponse.json({ participantes: result.rows });
  } catch (err) {
    console.error('[api/participantes] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
