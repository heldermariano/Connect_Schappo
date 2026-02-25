'use client';

import { ChatInterno } from '@/lib/types';
import StatusBadge, { StatusPresenca } from '@/components/ui/StatusBadge';

interface ChatInternoListProps {
  chats: ChatInterno[];
  activeId: number | null;
  onSelect: (chat: ChatInterno) => void;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function ChatInternoList({ chats, activeId, onSelect }: ChatInternoListProps) {
  if (chats.length === 0) return null;

  return (
    <div>
      <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        Conversas Recentes
      </div>
      {chats.map((chat) => (
        <button
          key={chat.id}
          onClick={() => onSelect(chat)}
          className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors border-b border-gray-100 dark:border-gray-800 ${
            activeId === chat.id ? 'bg-schappo-50 dark:bg-schappo-500/15 border-l-2 border-l-schappo-500' : 'hover:bg-gray-50 dark:hover:bg-white/5'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-schappo-100 flex items-center justify-center text-xs font-bold text-schappo-700 shrink-0">
            {chat.outro_nome?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{chat.outro_nome}</span>
              <span className="text-[11px] text-gray-400 shrink-0 ml-2">{formatTime(chat.ultima_msg_at)}</span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{chat.ultima_mensagem || 'Sem mensagens'}</span>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <StatusBadge status={(chat.outro_status || 'offline') as StatusPresenca} size="sm" />
                {(chat.nao_lidas ?? 0) > 0 && (
                  <span className="min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-schappo-500 text-white text-[10px] font-bold">
                    {chat.nao_lidas}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
