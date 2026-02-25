'use client';

import { Contato } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

interface ContatoItemProps {
  contato: Contato;
  onClick: () => void;
}

function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const num = phone.replace(/\D/g, '');
  if (num.length === 13 && num.startsWith('55')) {
    return `(${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
  }
  if (num.length === 12 && num.startsWith('55')) {
    return `(${num.slice(2, 4)}) ${num.slice(4, 8)}-${num.slice(8)}`;
  }
  return phone;
}

const CATEGORIA_LABELS: Record<string, string> = {
  eeg: 'EEG',
  recepcao: 'Recepção',
  geral: 'Geral',
};

export default function ContatoItem({ contato, onClick }: ContatoItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 transition-colors"
    >
      <Avatar nome={contato.nome} avatarUrl={contato.avatar_url} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {contato.nome}
          </span>
          {contato.categoria && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-schappo-100 text-schappo-700 shrink-0">
              {CATEGORIA_LABELS[contato.categoria] || contato.categoria}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
          {formatPhone(contato.telefone)}
        </span>
      </div>
    </button>
  );
}
