import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, type AuthUser } from './auth';
import { GRUPO_CATEGORIAS } from './types';

// Resultado de autenticacao bem-sucedida
export interface AuthResult {
  session: { user: AuthUser };
  userId: number;
  grupo: string;
  categoriasPermitidas: string[];
}

/**
 * Valida sessao e extrai dados do usuario autenticado.
 * Retorna AuthResult ou NextResponse 401.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const userId = parseInt(session.user.id as string);
  if (!userId) {
    return NextResponse.json({ error: 'Atendente nao identificado' }, { status: 401 });
  }

  const grupo = session.user.grupo || 'todos';
  const categoriasPermitidas = GRUPO_CATEGORIAS[grupo] || GRUPO_CATEGORIAS.todos;

  return { session: session as { user: AuthUser }, userId, grupo, categoriasPermitidas };
}

/**
 * Type guard: verifica se o resultado eh autenticacao valida (nao um erro).
 */
export function isAuthed(result: AuthResult | NextResponse): result is AuthResult {
  return !(result instanceof NextResponse);
}

/**
 * Verifica se o grupo do usuario tem acesso a uma categoria.
 */
export function checkCategoryAccess(categoriasPermitidas: string[], categoria: string): boolean {
  return categoriasPermitidas.includes(categoria);
}

/**
 * Resposta de erro padronizada.
 */
export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Resposta de sucesso padronizada.
 */
export function apiSuccess(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
