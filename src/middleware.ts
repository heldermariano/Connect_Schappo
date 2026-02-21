import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Rotas publicas que nao exigem autenticacao
const PUBLIC_PATHS = [
  '/api/webhook/',
  '/api/health',
  '/api/auth/',
  '/login',
  '/_next/',
  '/favicon',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Libera rotas publicas
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Libera arquivos estaticos
  if (pathname.includes('.') && !pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Verificar sessao JWT do NextAuth
  const token = await getToken({ req: request });

  if (!token) {
    // Para rotas de API, retornar 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }
    // Para paginas, redirecionar para login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplica middleware em todas as rotas exceto _next, arquivos estaticos
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)',
  ],
};
