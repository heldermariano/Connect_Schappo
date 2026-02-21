import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isAMIConnected, getActiveCallsCount } from '@/lib/ami-listener';

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Verifica conexao com PostgreSQL
  try {
    const result = await pool.query('SELECT NOW() AS time, current_schema() AS schema');
    checks.database = 'ok';
    checks.db_time = result.rows[0].time;
  } catch (err) {
    checks.database = 'error';
    checks.db_error = err instanceof Error ? err.message : 'unknown';
    healthy = false;
  }

  // Verifica se tabelas do schema atd existem
  try {
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'atd'
      ORDER BY table_name
    `);
    checks.tables = result.rows.map((r) => r.table_name).join(', ');
  } catch {
    checks.tables = 'error';
    healthy = false;
  }

  // Status AMI (nao afeta health — pode estar desconectado no dev)
  checks.ami = isAMIConnected() ? 'connected' : 'disconnected';
  checks.ami_active_calls = String(getActiveCallsCount());

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      version: '1.0.0',
      phase: '1C',
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
