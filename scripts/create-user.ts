/**
 * Script para criar/atualizar atendentes com senha hash via CLI.
 *
 * Uso:
 *   npx tsx scripts/create-user.ts --username renata --password SENHA --nome "Renata" --grupo eeg --ramal 201
 *   npx tsx scripts/create-user.ts --username renata --password NOVA_SENHA  (atualiza apenas a senha)
 *   npx tsx scripts/create-user.ts --set-all --password schappo123  (define senha para todos sem senha)
 */

import { hash } from 'bcryptjs';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://connect_dev:61EIOs7zD8K5N@localhost:5432/connect_schappo';

const pool = new Pool({ connectionString: DATABASE_URL });

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
      args[key] = value;
      if (value !== 'true') i++;
    }
  }
  return args;
}

async function setAllPasswords(password: string) {
  const passwordHash = await hash(password, 12);
  const result = await pool.query(
    `UPDATE atd.atendentes SET password_hash = $1 WHERE password_hash IS NULL OR password_hash = '' RETURNING nome, username`,
    [passwordHash],
  );
  console.log(`Senha definida para ${result.rowCount} atendente(s):`);
  for (const row of result.rows) {
    console.log(`  - ${row.nome} (${row.username})`);
  }
}

async function createOrUpdateUser(args: Record<string, string>) {
  const { username, password, nome, grupo, ramal, role } = args;

  if (!username) {
    console.error('Erro: --username eh obrigatorio');
    process.exit(1);
  }
  if (!password) {
    console.error('Erro: --password eh obrigatorio');
    process.exit(1);
  }

  const passwordHash = await hash(password, 12);

  // Verificar se o usuario ja existe
  const existing = await pool.query(
    `SELECT id, nome FROM atd.atendentes WHERE username = $1`,
    [username],
  );

  if (existing.rows.length > 0) {
    // Atualizar senha (e outros campos se fornecidos)
    const updates: string[] = ['password_hash = $1'];
    const values: (string | null)[] = [passwordHash];
    let paramIndex = 2;

    if (nome) { updates.push(`nome = $${paramIndex}`); values.push(nome); paramIndex++; }
    if (grupo) { updates.push(`grupo_atendimento = $${paramIndex}`); values.push(grupo); paramIndex++; }
    if (ramal) { updates.push(`ramal = $${paramIndex}`); values.push(ramal); paramIndex++; }
    if (role) { updates.push(`role = $${paramIndex}`); values.push(role); paramIndex++; }

    values.push(username);
    await pool.query(
      `UPDATE atd.atendentes SET ${updates.join(', ')} WHERE username = $${paramIndex}`,
      values,
    );
    console.log(`Atendente "${existing.rows[0].nome}" (${username}) atualizado.`);
  } else {
    // Criar novo
    if (!nome) {
      console.error('Erro: --nome eh obrigatorio para novo atendente');
      process.exit(1);
    }
    await pool.query(
      `INSERT INTO atd.atendentes (nome, username, password_hash, grupo_atendimento, ramal, role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nome, username, passwordHash, grupo || 'todos', ramal || null, role || 'atendente'],
    );
    console.log(`Atendente "${nome}" (${username}) criado.`);
  }
}

async function main() {
  const args = parseArgs();

  try {
    if (args['set-all']) {
      if (!args.password) {
        console.error('Erro: --password eh obrigatorio com --set-all');
        process.exit(1);
      }
      await setAllPasswords(args.password);
    } else {
      await createOrUpdateUser(args);
    }
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
