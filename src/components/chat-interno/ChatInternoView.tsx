'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatInterno, ChatInternoMensagem } from '@/lib/types';
import ChatInternoMessage from './ChatInternoMessage';
import StatusBadge, { StatusPresenca } from '@/components/ui/StatusBadge';

interface ChatInternoViewProps {
  chat: ChatInterno | null;
  mensagens: ChatInternoMensagem[];
  loading: boolean;
  currentUserId: number;
  onSend: (chatId: number, conteudo: string) => void;
}

export default function ChatInternoView({ chat, mensagens, loading, currentUserId, onSend }: ChatInternoViewProps) {
  const [texto, setTexto] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  useEffect(() => {
    if (mensagens.length > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCountRef.current = mensagens.length;
  }, [mensagens.length]);

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">Selecione um operador para iniciar uma conversa</p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    onSend(chat.id, texto.trim());
    setTexto('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="h-14 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-3 bg-white dark:bg-gray-800 shrink-0">
        <div className="w-8 h-8 rounded-full bg-schappo-100 flex items-center justify-center text-xs font-bold text-schappo-700">
          {chat.outro_nome?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{chat.outro_nome}</div>
        </div>
        <StatusBadge status={(chat.outro_status || 'offline') as StatusPresenca} />
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Carregando...</div>
        ) : mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Nenhuma mensagem ainda</div>
        ) : (
          <>
            {mensagens.map((msg) => (
              <ChatInternoMessage
                key={msg.id}
                mensagem={msg}
                isOwn={msg.atendente_id === currentUserId}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          className="px-4 py-2 bg-schappo-500 text-white text-sm font-medium rounded-lg hover:bg-schappo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
