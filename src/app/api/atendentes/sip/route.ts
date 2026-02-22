import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { encryptSipPassword, decryptSipPassword } from '@/lib/sip-config';

/**
 * GET /api/atendentes/sip — Retorna configuracoes SIP do operador autenticado.
 * A senha eh descriptografada e enviada via HTTPS.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await pool.query(
      `SELECT sip_server, sip_port, sip_username, sip_password_encrypted, sip_transport, sip_enabled
       FROM atd.atendentes WHERE id = $1`,
      [session.user.id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const row = result.rows[0];
    let sipPassword = '';

    if (row.sip_password_encrypted) {
      try {
        sipPassword = decryptSipPassword(row.sip_password_encrypted);
      } catch {
        sipPassword = '';
      }
    }

    return NextResponse.json({
      sip_server: row.sip_server || '',
      sip_port: row.sip_port || 8089,
      sip_username: row.sip_username || '',
      sip_password: sipPassword,
      sip_transport: row.sip_transport || 'wss',
      sip_enabled: row.sip_enabled || false,
    });
  } catch (err) {
    console.error('[api/atendentes/sip] GET Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

/**
 * PUT /api/atendentes/sip — Salva configuracoes SIP do operador autenticado.
 * A senha eh criptografada antes de gravar.
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sip_server, sip_port, sip_username, sip_password, sip_transport, sip_enabled } = body;

    let encryptedPassword: string | null = null;
    if (sip_password) {
      encryptedPassword = encryptSipPassword(sip_password);
    }

    // Construir UPDATE dinamicamente (nao sobrescrever senha se nao foi enviada)
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (sip_server !== undefined) {
      setClauses.push(`sip_server = $${idx++}`);
      values.push(sip_server);
    }
    if (sip_port !== undefined) {
      setClauses.push(`sip_port = $${idx++}`);
      values.push(sip_port);
    }
    if (sip_username !== undefined) {
      setClauses.push(`sip_username = $${idx++}`);
      values.push(sip_username);
    }
    if (encryptedPassword !== null) {
      setClauses.push(`sip_password_encrypted = $${idx++}`);
      values.push(encryptedPassword);
    }
    if (sip_transport !== undefined) {
      setClauses.push(`sip_transport = $${idx++}`);
      values.push(sip_transport);
    }
    if (sip_enabled !== undefined) {
      setClauses.push(`sip_enabled = $${idx++}`);
      values.push(sip_enabled);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(session.user.id);

    await pool.query(
      `UPDATE atd.atendentes SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      values,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/atendentes/sip] PUT Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
