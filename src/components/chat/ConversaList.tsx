'use client';

import { useState, useCallback } from 'react';
import { Conversa } from '@/lib/types';
import ConversaItem from './ConversaItem';
import ConversaContextMenu from './ConversaContextMenu';

interface ConversaListProps {
  conversas: Conversa[];
  activeId: number | null;
  onSelect: (conversa: Conversa) => void;
  loading: boolean;
  mencionadoEm?: Set<number>;
  flashingConversas?: Set<number>;
  urgentConversas?: Set<number>;
  onMarkUnread?: (conversaId: number) => void;
  onMarkResolved?: (conversaId: number) => void;
  onDelete?: (conversaId: number) => void;
  isAdmin?: boolean;
}

export default function ConversaList({
  conversas,
  activeId,
  onSelect,
  loading,
  mencionadoEm,
  flashingConversas,
  urgentConversas,
  onMarkUnread,
  onMarkResolved,
  onDelete,
  isAdmin,
}: ConversaListProps) {
  const [contextMenu, setContextMenu] = useState<{ conversa: Conversa; position: { x: number; y: number } } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, conversa: Conversa) => {
    e.preventDefault();
    setContextMenu({ conversa, position: { x: e.clientX, y: e.clientY } });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        Carregando...
      </div>
    );
  }

  if (conversas.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm p-4 text-center">
        Nenhuma conversa encontrada
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversas.map((conversa) => (
        <div
          key={conversa.id}
          onContextMenu={(e) => handleContextMenu(e, conversa)}
        >
          <ConversaItem
            conversa={conversa}
            active={conversa.id === activeId}
            onClick={() => onSelect(conversa)}
            mencionado={mencionadoEm?.has(conversa.id)}
            flash={flashingConversas?.has(conversa.id)}
            isUrgent={urgentConversas?.has(conversa.id)}
          />
        </div>
      ))}

      {/* Menu de contexto */}
      {contextMenu && onMarkUnread && onMarkResolved && (
        <ConversaContextMenu
          conversa={contextMenu.conversa}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onMarkUnread={onMarkUnread}
          onMarkResolved={onMarkResolved}
          onDelete={onDelete}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
