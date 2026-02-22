import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.SIP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('SIP_ENCRYPTION_KEY nao definida');
  }
  // Chave deve ter 32 bytes (256 bits) - fazer hash se necessario
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('SIP_ENCRYPTION_KEY deve ter 64 caracteres hex (32 bytes)');
  }
  return keyBuffer;
}

/** Criptografar senha SIP com AES-256-GCM */
export function encryptSipPassword(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Formato: iv:tag:ciphertext (tudo em hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/** Descriptografar senha SIP */
export function decryptSipPassword(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de senha criptografada invalido');
  }

  const [ivHex, tagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/** Gerar UserAgent options para SIP.js no frontend */
export function buildSipUserAgentOptions(config: {
  server: string;
  port: number;
  username: string;
  password: string;
  transport: 'wss' | 'ws';
}) {
  const scheme = config.transport === 'wss' ? 'wss' : 'ws';
  const wsServer = `${scheme}://${config.server}:${config.port}/ws`;

  return {
    uri: `sip:${config.username}@${config.server}`,
    transportOptions: {
      server: wsServer,
    },
    authorizationUsername: config.username,
    authorizationPassword: config.password,
    displayName: config.username,
  };
}
