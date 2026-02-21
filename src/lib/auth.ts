import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import pool from './db';

// Tipo customizado para o usuario autenticado
export interface AuthUser {
  id: string;
  nome: string;
  username: string;
  grupo: string;
  role: string;
  ramal: string | null;
}

// Estende os tipos do NextAuth
declare module 'next-auth' {
  interface Session {
    user: AuthUser;
  }
  interface User extends AuthUser {}
}

declare module 'next-auth/jwt' {
  interface JWT extends AuthUser {}
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuário', type: 'text' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const result = await pool.query(
          `SELECT id, nome, username, password_hash, grupo_atendimento, role, ramal
           FROM atd.atendentes
           WHERE username = $1 AND ativo = true`,
          [credentials.username],
        );

        const user = result.rows[0];
        if (!user || !user.password_hash) {
          return null;
        }

        const isValid = await compare(credentials.password, user.password_hash);
        if (!isValid) {
          return null;
        }

        // Atualizar ultimo_acesso
        await pool.query(
          `UPDATE atd.atendentes SET ultimo_acesso = NOW(), status_presenca = 'disponivel' WHERE id = $1`,
          [user.id],
        );

        return {
          id: String(user.id),
          nome: user.nome,
          username: user.username,
          grupo: user.grupo_atendimento,
          role: user.role,
          ramal: user.ramal || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nome = user.nome;
        token.username = user.username;
        token.grupo = user.grupo;
        token.role = user.role;
        token.ramal = user.ramal;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        nome: token.nome as string,
        username: token.username as string,
        grupo: token.grupo as string,
        role: token.role as string,
        ramal: (token.ramal as string) || null,
      };
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 12 * 60 * 60, // 12 horas
  },
};
