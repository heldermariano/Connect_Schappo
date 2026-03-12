import { Mensagem } from '@/lib/types';

/**
 * Retorna label para separador de data: "Hoje", "Ontem" ou "dd/mm/yyyy"
 */
export function getDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Hoje';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem';
  } else {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}

/**
 * Determina se deve exibir separador de data entre duas mensagens.
 * Retorna true quando a data muda (ou quando nao ha mensagem anterior).
 */
export function shouldShowDateSeparator(currentMsg: Mensagem, prevMsg: Mensagem | null): boolean {
  const msgDate = currentMsg.created_at ? new Date(currentMsg.created_at) : null;
  if (!msgDate) return false;

  const prevDate = prevMsg?.created_at ? new Date(prevMsg.created_at) : null;
  return !prevDate || msgDate.toDateString() !== prevDate.toDateString();
}

/**
 * Filtra mensagens por conteudo (busca case-insensitive).
 * Retorna somente mensagens cujo conteudo contem o termo.
 */
export function filterMessagesBySearch(mensagens: Mensagem[], searchTerm: string): Mensagem[] {
  if (!searchTerm || searchTerm.length < 2) return [];
  const term = searchTerm.toLowerCase();
  return mensagens.filter((m) => m.conteudo?.toLowerCase().includes(term));
}
