import { NextRequest, NextResponse } from 'next/server';

// Rotas que nao exigem autenticacao
const PUBLIC_PATHS = ['/api/webhook/', '/api/health'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Libera webhooks e health check sem auth
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Basic Auth para demais rotas
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Autenticacao necessaria', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Connect Schappo"' },
    });
  }

  const base64 = authHeader.slice(6);
  const decoded = atob(base64);
  const [user, pass] = decoded.split(':');

  const validUser = process.env.PANEL_USER || 'admin';
  const validPass = process.env.PANEL_PASS || 'admin123';

  if (user !== validUser || pass !== validPass) {
    return new NextResponse('Credenciais invalidas', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Connect Schappo"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplica middleware em todas as rotas exceto _next, arquivos estaticos
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
