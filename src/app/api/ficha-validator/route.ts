import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFichaValidatorStatus, startFichaValidator, stopFichaValidator } from '@/lib/ficha-validator';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  return NextResponse.json(getFichaValidatorStatus());
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
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
