'use client';

import { Conversa } from '@/lib/types';
import ConversaItem from './ConversaItem';

interface ConversaListProps {
  conversas: Conversa[];
  activeId: number | null;
  onSelect: (conversa: Conversa) => void;
  loading: boolean;
  mencionadoEm?: Set<number>;
}

export default function ConversaList({ conversas, activeId, onSelect, loading, mencionadoEm }: ConversaListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (conversas.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4 text-center">
        Nenhuma conversa encontrada
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversas.map((conversa) => (
        <ConversaItem
          key={conversa.id}
          conversa={conversa}
          active={conversa.id === activeId}
          onClick={() => onSelect(conversa)}
          mencionado={mencionadoEm?.has(conversa.id)}
        />
      ))}
    </div>
  );
}
