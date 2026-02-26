'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Conversa } from '@/lib/types';

interface ConversaContextMenuProps {
  conversa: Conversa;
  position: { x: number; y: number };
  onClose: () => void;
  onMarkUnread: (conversaId: number) => void;
  onMarkResolved: (conversaId: number) => void;
  onDelete?: (conversaId: number) => void;
  isAdmin?: boolean;
}

export default function ConversaContextMenu({
  conversa,
  position,
  onClose,
  onMarkUnread,
  onMarkResolved,
  onDelete,
  isAdmin,
}: ConversaContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora ou Escape
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      onClose();
    }
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  // Ajustar posicao se sair da tela
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 220),
    top: Math.min(position.y, window.innerHeight - 300),
    zIndex: 9999,
  };

  const isResolved = conversa.is_archived;
  const hasUnread = conversa.nao_lida > 0;

  return (
    <div ref={menuRef} style={style} className="w-52 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 text-sm">
      {/* Marcar como lida/nao lida */}
      <button
        onClick={() => { onMarkUnread(conversa.id); onClose(); }}
        className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {hasUnread ? 'Marcar como lida' : 'Marcar como nao lida'}
      </button>

      {/* Marcar como resolvida/reabrir */}
      <button
        onClick={() => { onMarkResolved(conversa.id); onClose(); }}
        className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {isResolved ? 'Reabrir conversa' : 'Marcar como resolvida'}
      </button>

      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

      {/* Excluir conversa (admin) */}
      {isAdmin && onDelete && (
        <>
          <button
            onClick={() => {
              if (confirm('Tem certeza que deseja excluir esta conversa?')) {
                onDelete(conversa.id);
              }
              onClose();
            }}
            className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Excluir conversa
          </button>
        </>
      )}
    </div>
  );
}
