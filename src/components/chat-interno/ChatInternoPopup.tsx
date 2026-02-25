'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { ChatInterno, ChatInternoMensagem } from '@/lib/types';
import { useChatInterno, useChatInternoMensagens } from '@/hooks/useChatInterno';
import { playNotificationBeep } from '@/lib/notification';
import { useAppContext } from '@/contexts/AppContext';
import OperatorList from './OperatorList';
import ChatInternoList from './ChatInternoList';
import ChatInternoView from './ChatInternoView';

export interface ChatInternoSSEData {
  chat_id: number;
  mensagem: ChatInternoMensagem;
  destinatario_id: number;
}

interface ChatInternoPopupProps {
  onClose: () => void;
  sseMessage?: ChatInternoSSEData | null;
}

export default function ChatInternoPopup({ onClose, sseMessage }: ChatInternoPopupProps) {
  const { data: session } = useSession();
  const { refreshChatInternoUnread } = useAppContext();
  const [selectedChat, setSelectedChat] = useState<ChatInterno | null>(null);

  const userId = session?.user?.id ? parseInt(session.user.id as string) : 0;
  const { chats, criarChat, updateChat } = useChatInterno();
  const { mensagens, loading: loadingMsgs, addMensagem, sendMensagem } = useChatInternoMensagens(selectedChat?.id ?? null);

  const selectedChatRef = useRef<ChatInterno | null>(null);
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

  // Processar mensagens SSE repassadas pelo AppShell
  const lastProcessedRef = useRef<number>(0);
  useEffect(() => {
    if (!sseMessage || sseMessage.destinatario_id !== userId) return;
    if (sseMessage.mensagem.id === lastProcessedRef.current) return;
    lastProcessedRef.current = sseMessage.mensagem.id;

    updateChat(sseMessage.chat_id, {
      ultima_mensagem: sseMessage.mensagem.conteudo?.substring(0, 200),
      ultima_msg_at: sseMessage.mensagem.created_at,
    });

    if (selectedChatRef.current && selectedChatRef.current.id === sseMessage.chat_id) {
      addMensagem(sseMessage.mensagem);
      refreshChatInternoUnread();
    } else {
      playNotificationBeep();
    }
  }, [sseMessage, userId, updateChat, addMensagem, refreshChatInternoUnread]);

  const handleSelectOperador = useCallback(async (operador: { id: number; nome: string }) => {
    const chat = await criarChat(operador.id);
    if (chat) {
      setSelectedChat(chat);
    }
  }, [criarChat]);

  const handleSelectChat = useCallback((chat: ChatInterno) => {
    setSelectedChat(chat);
    // Marcar como lida ao abrir
    refreshChatInternoUnread();
  }, [refreshChatInternoUnread]);

  const handleSend = useCallback((chatId: number, conteudo: string) => {
    sendMensagem(chatId, conteudo);
    updateChat(chatId, {
      ultima_mensagem: conteudo.substring(0, 200),
      ultima_msg_at: new Date().toISOString(),
    });
  }, [sendMensagem, updateChat]);

  const handleBack = useCallback(() => {
    setSelectedChat(null);
  }, []);

  return (
    <div className="fixed bottom-20 right-6 z-[9998] w-[380px] h-[520px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-12 bg-schappo-500 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          {selectedChat && (
            <button
              onClick={handleBack}
              className="text-white/80 hover:text-white transition-colors mr-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-1m0-3V6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2h-4l-4 4V10H7a2 2 0 01-2-2z" />
          </svg>
          <span className="text-white font-semibold text-sm">
            {selectedChat ? selectedChat.outro_nome : 'Chat Interno'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Conteudo */}
      {selectedChat ? (
        <ChatInternoView
          chat={selectedChat}
          mensagens={mensagens}
          loading={loadingMsgs}
          currentUserId={userId}
          onSend={handleSend}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <OperatorList
            currentUserId={userId}
            onSelect={handleSelectOperador}
          />
          <div className="border-t border-gray-200 dark:border-gray-700">
            <ChatInternoList
              chats={chats}
              activeId={null}
              onSelect={handleSelectChat}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export tipos para uso pelo AppShell
export type { ChatInternoPopupProps };
