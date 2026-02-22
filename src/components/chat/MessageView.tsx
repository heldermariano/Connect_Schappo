'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Conversa, Mensagem } from '@/lib/types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import AtribuirDropdown from './AtribuirDropdown';
import Avatar from '@/components/ui/Avatar';
import CallButton from '@/components/calls/CallButton';

interface MessageViewProps {
  conversa: Conversa | null;
  mensagens: Mensagem[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSend: (conversaId: number, conteudo: string) => Promise<void>;
  onMarcarLida: (conversaId: number) => void;
  onAtribuir: (conversaId: number, atendenteId: number | null) => void;
  onDialNumber?: (number: string) => void;
}

export default function MessageView({
  conversa,
  mensagens,
  loading,
  hasMore,
  onLoadMore,
  onSend,
  onMarcarLida,
  onAtribuir,
  onDialNumber,
}: MessageViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markedReadRef = useRef<number | null>(null);

  // Auto-scroll para ultima mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

  // Marcar como lida ao selecionar conversa
  useEffect(() => {
    if (conversa && conversa.nao_lida > 0 && markedReadRef.current !== conversa.id) {
      markedReadRef.current = conversa.id;
      onMarcarLida(conversa.id);
    }
    if (!conversa) {
      markedReadRef.current = null;
    }
  }, [conversa, onMarcarLida]);

  const handleSend = useCallback(
    async (conteudo: string) => {
      if (!conversa) return;
      await onSend(conversa.id, conteudo);
    },
    [conversa, onSend],
  );

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
            {conversa.telefone && ` \u00B7 ${conversa.telefone}`}
          </div>
        </div>
        <AtribuirDropdown
          conversaId={conversa.id}
          atendenteId={conversa.atendente_id}
          atendenteNome={(conversa as Conversa & { atendente_nome?: string }).atendente_nome}
          onAtribuir={onAtribuir}
        />
        {/* Click-to-call: apenas para conversas individuais com telefone */}
        {!isGroup && conversa.telefone && onDialNumber && (
          <button
            onClick={() => onDialNumber(conversa.telefone!)}
            className="p-2 text-gray-400 hover:text-schappo-600 transition-colors"
            title="Discar no softphone"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        )}
        {!isGroup && conversa.telefone && !onDialNumber && (
          <CallButton telefone={conversa.telefone} size="md" label="Ligar" />
        )}
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

      {/* Campo de envio de mensagem */}
      <MessageInput onSend={handleSend} />
    </div>
  );
}
