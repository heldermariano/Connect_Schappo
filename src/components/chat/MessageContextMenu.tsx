'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Mensagem } from '@/lib/types';

interface MessageContextMenuProps {
  x: number;
  y: number;
  mensagem: Mensagem;
  isAdmin: boolean;
  isOwnMessage: boolean;
  onCopy: () => void;
  onReply: () => void;
  onForward: () => void;
  onReact: () => void;
  onDelete: () => void;
  onClose: () => void;
}

interface MenuOption {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  visible: boolean;
  danger?: boolean;
}

export default function MessageContextMenu({
  x, y, mensagem, isAdmin, isOwnMessage,
  onCopy, onReply, onForward, onReact, onDelete, onClose,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Reposicionar se sair da tela
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      el.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, [x, y]);

  const handleClose = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      onClose();
    }
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const handleScroll = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClose);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [handleClose, handleKeyDown, handleScroll]);

  const options: MenuOption[] = [
    {
      label: 'Copiar',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      onClick: onCopy,
      visible: true,
    },
    {
      label: 'Responder',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      ),
      onClick: onReply,
      visible: true,
    },
    {
      label: 'Reagir',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: onReact,
      visible: true,
    },
    {
      label: 'Encaminhar',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      ),
      onClick: onForward,
      visible: true,
    },
    {
      label: 'Apagar',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      onClick: onDelete,
      visible: isAdmin || isOwnMessage,
      danger: true,
    },
  ];

  const visibleOptions = options.filter((o) => o.visible);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-black rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
      style={{ left: x, top: y }}
    >
      {visibleOptions.map((option) => (
        <button
          key={option.label}
          onClick={() => {
            option.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
            option.danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
