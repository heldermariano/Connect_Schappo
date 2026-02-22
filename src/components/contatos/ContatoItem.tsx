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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
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
      className="w-full text-left px-4 py-3 border-b border-gray-100 flex gap-3 hover:bg-gray-50 transition-colors"
    >
      <Avatar nome={contato.nome} avatarUrl={contato.avatar_url} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 truncate">
            {contato.nome}
          </span>
          {contato.ultima_msg_at && (
            <span className="text-[11px] text-gray-400 shrink-0 ml-2">
              {formatDate(contato.ultima_msg_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <div className="min-w-0">
            <span className="text-xs text-gray-500 block">
              {formatPhone(contato.telefone)}
            </span>
            {contato.email && (
              <span className="text-[11px] text-gray-400 block truncate">
                {contato.email}
              </span>
            )}
          </div>
          {contato.categoria && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-schappo-100 text-schappo-700 shrink-0 ml-2">
              {CATEGORIA_LABELS[contato.categoria] || contato.categoria}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
