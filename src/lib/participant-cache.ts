import pool from './db';

/**
 * Faz upsert de um participante de grupo no cache.
 * Chamado quando recebemos uma mensagem de grupo com sender_phone e senderName.
 */
export async function upsertParticipant(
  waPhone: string,
  waChatid: string,
  nomeWhatsapp: string | null,
  avatarUrl?: string | null,
): Promise<void> {
  if (!waPhone || !waChatid) return;

  // So salvar se tem nome real (nao vazio, nao eh apenas numeros)
  const hasRealName = nomeWhatsapp && nomeWhatsapp.trim() && !/^\d+$/.test(nomeWhatsapp.trim());

  await pool.query(
    `INSERT INTO atd.participantes_grupo (wa_phone, wa_chatid, nome_whatsapp, avatar_url, atualizado_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (wa_phone, wa_chatid) DO UPDATE SET
       nome_whatsapp = CASE
         WHEN $3 IS NOT NULL AND $3 != '' THEN $3
         ELSE atd.participantes_grupo.nome_whatsapp
       END,
       avatar_url = CASE
         WHEN $4 IS NOT NULL AND $4 != '' THEN $4
         ELSE atd.participantes_grupo.avatar_url
       END,
       atualizado_at = NOW()`,
    [waPhone, waChatid, hasRealName ? nomeWhatsapp!.trim() : null, avatarUrl || null],
  );
}

/**
 * Busca o nome de um participante no cache.
 * Retorna null se nao encontrar.
 */
export async function resolveParticipantName(
  waPhone: string,
  waChatid: string,
): Promise<string | null> {
  const result = await pool.query(
    `SELECT nome_salvo, nome_whatsapp FROM atd.participantes_grupo
     WHERE wa_phone = $1 AND wa_chatid = $2`,
    [waPhone, waChatid],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  // Prioridade: nome_salvo > nome_whatsapp
  return row.nome_salvo || row.nome_whatsapp || null;
}

/**
 * Formata um numero de telefone para exibicao.
 * Ex: "5561999999999" → "(61) 99999-9999"
 */
export function formatPhoneDisplay(phone: string): string {
  // Remover prefixo 55 (Brasil)
  const num = phone.replace(/\D/g, '');
  if (num.length === 13 && num.startsWith('55')) {
    const ddd = num.slice(2, 4);
    const part1 = num.slice(4, 9);
    const part2 = num.slice(9);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (num.length === 12 && num.startsWith('55')) {
    const ddd = num.slice(2, 4);
    const part1 = num.slice(4, 8);
    const part2 = num.slice(8);
    return `(${ddd}) ${part1}-${part2}`;
  }
  return phone;
}
