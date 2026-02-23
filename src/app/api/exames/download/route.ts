import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Proxy para download de PDFs do NeuroSchappo (evita CORS)
// Recebe a download_url completa (já inclui token HMAC)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'URL obrigatoria' }, { status: 400 });
  }

  // Validar que a URL e do NeuroSchappo (seguranca)
  const allowed = ['eeg.clinicaschappo.com', '10.150.77.77'];
  try {
    const parsed = new URL(url);
    if (!allowed.some((h) => parsed.hostname === h)) {
      return NextResponse.json({ error: 'URL nao permitida' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'URL invalida' }, { status: 400 });
  }

  try {
    // Usar HTTP interno para evitar redirect HTTPS no servidor local
    const internalUrl = url.replace('http://eeg.clinicaschappo.com', 'http://10.150.77.77:3000')
                           .replace('https://eeg.clinicaschappo.com', 'http://10.150.77.77:3000');

    const res = await fetch(internalUrl);
    if (!res.ok) {
      return NextResponse.json({ error: `Erro ao baixar arquivo: ${res.status}` }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'application/pdf';
    const contentDisposition = res.headers.get('content-disposition') || '';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (err) {
    console.error('[api/exames/download] Erro:', err);
    return NextResponse.json({ error: 'Erro ao baixar arquivo' }, { status: 500 });
  }
}
