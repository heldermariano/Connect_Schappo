import { NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import { getFichaValidatorStatus, startFichaValidator, stopFichaValidator } from '@/lib/ficha-validator';

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  return NextResponse.json(getFichaValidatorStatus());
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const role = auth.session.user.role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === 'start') {
    startFichaValidator();
    return NextResponse.json({ message: 'Validador iniciado' });
  }

  if (action === 'stop') {
    stopFichaValidator();
    return NextResponse.json({ message: 'Validador parado' });
  }

  return NextResponse.json({ error: 'Acao invalida. Use "start" ou "stop"' }, { status: 400 });
}
