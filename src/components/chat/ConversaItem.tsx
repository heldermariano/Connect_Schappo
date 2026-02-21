'use client';

import { Conversa } from '@/lib/types';

interface ConversaItemProps {
  conversa: Conversa;
  active: boolean;
  onClick: () => void;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getCategoryBadge(conversa: Conversa): string | null {
  if (conversa.tipo === 'grupo') {
    if (conversa.categoria === 'eeg') return 'EEG';
    if (conversa.categoria === 'recepcao') return 'Recep';
    return null;
  }
  return null;
}

function getDisplayName(conversa: Conversa): string {
  if (conversa.tipo === 'grupo') {
    return conversa.nome_grupo || 'Grupo';
  }
  return conversa.nome_contato || conversa.telefone || 'Desconhecido';
}

// Cor do avatar baseada no hash do nome (consistente)
const AVATAR_COLORS = [
  'bg-schappo-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-teal-500',
];

function getAvatarColor(name: string): string {
  const code = name.charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function getInitials(conversa: Conversa): string {
  if (conversa.tipo === 'grupo') return 'G';
  const name = conversa.nome_contato || conversa.telefone || '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

export default function ConversaItem({ conversa, active, onClick }: ConversaItemProps) {
  const badge = getCategoryBadge(conversa);
  const name = getDisplayName(conversa);
  const initials = getInitials(conversa);
  const avatarColor = getAvatarColor(name);
  const hasAvatar = conversa.avatar_url && conversa.avatar_url.startsWith('http');

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-gray-100 flex gap-3 transition-colors ${
        active ? 'bg-schappo-50 border-l-2 border-l-schappo-500' : 'hover:bg-gray-50'
      }`}
    >
      {/* Avatar */}
      {hasAvatar ? (
        <img
          src={conversa.avatar_url!}
          alt={name}
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-sm font-medium text-white shrink-0`}>
          {initials}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 truncate">
            {name}
            {badge && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-schappo-100 text-schappo-700">
                {badge}
              </span>
            )}
          </span>
          <span className={`text-[11px] shrink-0 ml-2 ${conversa.nao_lida > 0 ? 'text-schappo-600 font-medium' : 'text-gray-400'}`}>
            {formatTime(conversa.ultima_msg_at)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-gray-500 truncate">
            {conversa.ultima_mensagem || 'Sem mensagens'}
          </span>
          {conversa.nao_lida > 0 && (
            <span className="ml-2 shrink-0 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-schappo-500 text-white text-[10px] font-bold">
              {conversa.nao_lida > 99 ? '99+' : conversa.nao_lida}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
