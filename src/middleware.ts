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

// Verifica se a rota /api/eeg/* tem token bot valido no header
function hasBotToken(request: NextRequest): boolean {
  const botToken = request.headers.get('x-bot-token');
  const secret = process.env.WEBHOOK_SECRET;
  return !!botToken && !!secret && botToken === secret;
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevenir clickjacking
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  // Prevenir MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissoes de features do browser — microphone=(self) necessario para Softphone WebRTC
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  // XSS protection (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  // HSTS (apenas se HTTPS ativo)
  if (process.env.NEXTAUTH_URL?.startsWith('https')) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Libera rotas publicas
  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Libera /api/eeg/* com token bot (N8N)
  if (pathname.startsWith('/api/eeg/') && hasBotToken(request)) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Libera arquivos estaticos
  if (pathname.includes('.') && !pathname.startsWith('/api/')) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Verificar sessao JWT do NextAuth
  const token = await getToken({ req: request });

  if (!token) {
    // Para rotas de API, retornar 401 JSON
    if (pathname.startsWith('/api/')) {
      return addSecurityHeaders(NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }));
    }
    // Para paginas, redirecionar para login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    // Aplica middleware em todas as rotas exceto _next, arquivos estaticos
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)',
  ],
};
