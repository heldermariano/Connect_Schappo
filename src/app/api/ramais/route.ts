import { NextResponse } from 'next/server';
import { getSipPeers } from '@/lib/ami-listener';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ramais
 * Retorna os ramais SIP online na faixa 100-120.
 */
export async function GET() {
  try {
    const peers = await getSipPeers(100, 120);
    const online = peers.filter((p) => p.status === 'online');
    return NextResponse.json(online);
  } catch (err) {
    console.error('[API] Erro ao buscar ramais:', err);
    return NextResponse.json([], { status: 500 });
  }
}
