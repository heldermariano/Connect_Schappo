'use client';

import { Conversa } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

interface ConversaItemProps {
  conversa: Conversa;
  active: boolean;
  onClick: () => void;
  mencionado?: boolean; // Se o atendente logado foi mencionado nesta conversa
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

export default function ConversaItem({ conversa, active, onClick, mencionado }: ConversaItemProps) {
  const badge = getCategoryBadge(conversa);
  const name = getDisplayName(conversa);
  const isGroup = conversa.tipo === 'grupo';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-gray-100 flex gap-3 transition-colors ${
        active ? 'bg-schappo-50 border-l-2 border-l-schappo-500' : 'hover:bg-gray-50'
      }`}
    >
      <Avatar nome={name} avatarUrl={conversa.avatar_url} size="md" isGroup={isGroup} />

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
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {mencionado && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-schappo-100 text-schappo-600">
                @ Mencionado
              </span>
            )}
            {conversa.nao_lida > 0 && (
              <span className="min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-schappo-500 text-white text-[10px] font-bold">
                {conversa.nao_lida > 99 ? '99+' : conversa.nao_lida}
              </span>
            )}
          </div>
        </div>
        {/* Badge de atribuição */}
        <div className="mt-0.5">
          {conversa.atendente_id ? (
            <span className="text-[10px] text-green-600">
              Respondido por <span className="font-semibold">{(conversa as Conversa & { atendente_nome?: string }).atendente_nome || 'Operador'}</span>
            </span>
          ) : (
            <span className="text-[10px] text-gray-400">Não atribuída</span>
          )}
        </div>
      </div>
    </button>
  );
}
