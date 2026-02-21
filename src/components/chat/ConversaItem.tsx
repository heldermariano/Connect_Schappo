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

function getTypeIcon(conversa: Conversa): string {
  if (conversa.tipo === 'grupo') return '\uD83D\uDC65';
  return '';
}

export default function ConversaItem({ conversa, active, onClick }: ConversaItemProps) {
  const badge = getCategoryBadge(conversa);
  const name = getDisplayName(conversa);
  const icon = getTypeIcon(conversa);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-gray-100 flex gap-3 transition-colors ${
        active ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-white shrink-0">
        {icon || name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 truncate">
            {name}
            {badge && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-700">
                {badge}
              </span>
            )}
          </span>
          <span className="text-[11px] text-gray-400 shrink-0 ml-2">
            {formatTime(conversa.ultima_msg_at)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-gray-500 truncate">
            {conversa.ultima_mensagem || 'Sem mensagens'}
          </span>
          {conversa.nao_lida > 0 && (
            <span className="ml-2 shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-green-500 text-white text-[10px] font-bold">
              {conversa.nao_lida > 99 ? '99+' : conversa.nao_lida}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
