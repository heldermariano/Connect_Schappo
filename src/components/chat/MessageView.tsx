'use client';

import { useEffect, useRef } from 'react';
import { Conversa, Mensagem } from '@/lib/types';
import MessageBubble from './MessageBubble';
import Avatar from '@/components/ui/Avatar';

interface MessageViewProps {
  conversa: Conversa | null;
  mensagens: Mensagem[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function MessageView({
  conversa,
  mensagens,
  loading,
  hasMore,
  onLoadMore,
}: MessageViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para ultima mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

  if (!conversa) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">Selecione uma conversa para visualizar</p>
        </div>
      </div>
    );
  }

  const isGroup = conversa.tipo === 'grupo';
  const displayName = isGroup
    ? conversa.nome_grupo || 'Grupo'
    : conversa.nome_contato || conversa.telefone || 'Desconhecido';

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header da conversa */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
        <Avatar nome={displayName} avatarUrl={conversa.avatar_url} size="sm" isGroup={isGroup} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
          <div className="text-[11px] text-gray-400 truncate">
            <span className="text-schappo-600 font-medium">{conversa.categoria.toUpperCase()}</span> &middot; {conversa.provider}
            {conversa.telefone && ` &middot; ${conversa.telefone}`}
          </div>
        </div>
      </div>

      {/* Area de mensagens */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3">
        {hasMore && (
          <div className="text-center mb-3">
            <button
              onClick={onLoadMore}
              className="text-xs text-schappo-600 hover:underline"
            >
              Carregar mensagens anteriores
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Carregando mensagens...
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Nenhuma mensagem
          </div>
        ) : (
          mensagens.map((msg) => (
            <MessageBubble key={msg.id} mensagem={msg} showSender={isGroup} />
          ))
        )}

        <div ref={bottomRef} />
      </div>

      {/* Barra de status read-only */}
      <div className="h-10 bg-gray-100 border-t border-gray-200 flex items-center justify-center text-xs text-gray-400 shrink-0">
        Modo visualizacao &mdash; Fase 1 (read-only)
      </div>
    </div>
  );
}
