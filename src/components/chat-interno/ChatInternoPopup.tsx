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

export interface ChatInternoReacaoSSEData {
  chat_id: number;
  mensagem_id: number;
  reacoes: Array<{ emoji: string; atendente_id: number; nome: string }>;
  destinatario_id: number;
}

interface AutoOpenChat {
  chat_id: number;
  sender_id: number;
  sender_name: string;
}

interface ChatInternoPopupProps {
  onClose: () => void;
  sseMessage?: ChatInternoSSEData | null;
  sseReacao?: ChatInternoReacaoSSEData | null;
  autoOpenChat?: AutoOpenChat | null;
  onAutoOpenHandled?: () => void;
}

export default function ChatInternoPopup({ onClose, sseMessage, sseReacao, autoOpenChat, onAutoOpenHandled }: ChatInternoPopupProps) {
  const { data: session } = useSession();
  const { refreshChatInternoUnread } = useAppContext();
  const [selectedChat, setSelectedChat] = useState<ChatInterno | null>(null);

  const userId = session?.user?.id ? parseInt(session.user.id as string) : 0;
  const { chats, criarChat, updateChat } = useChatInterno();
  const { mensagens, loading: loadingMsgs, addMensagem, sendMensagem, sendMedia, reactToMessage, updateMessageReacoes } = useChatInternoMensagens(selectedChat?.id ?? null);

  const selectedChatRef = useRef<ChatInterno | null>(null);
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

  // Auto-abrir na conversa quando recebe autoOpenChat do AppShell
  const autoOpenHandledRef = useRef<number | null>(null);
  useEffect(() => {
    if (!autoOpenChat || autoOpenChat.sender_id === autoOpenHandledRef.current) return;
    autoOpenHandledRef.current = autoOpenChat.sender_id;

    // Verificar se ja existe um chat com esse sender nos chats carregados
    const existing = chats.find((c) => c.outro_id === autoOpenChat.sender_id);
    if (existing) {
      setSelectedChat(existing);
      refreshChatInternoUnread();
      onAutoOpenHandled?.();
    } else {
      // Criar/buscar chat via API
      criarChat(autoOpenChat.sender_id).then((chat) => {
        if (chat) {
          setSelectedChat(chat);
          refreshChatInternoUnread();
        }
        onAutoOpenHandled?.();
      });
    }
  }, [autoOpenChat, chats, criarChat, refreshChatInternoUnread, onAutoOpenHandled]);

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

  const handleSend = useCallback((chatId: number, conteudo: string, replyToId?: number) => {
    sendMensagem(chatId, conteudo, replyToId);
    updateChat(chatId, {
      ultima_mensagem: conteudo.substring(0, 200),
      ultima_msg_at: new Date().toISOString(),
    });
  }, [sendMensagem, updateChat]);

  const handleSendMedia = useCallback((chatId: number, file: File, caption?: string, voiceRecording?: boolean, replyToId?: number) => {
    sendMedia(chatId, file, caption, voiceRecording, replyToId);
    const previewText = caption || (file.type.startsWith('image/') ? 'Imagem' : file.type.startsWith('audio/') ? 'Audio' : 'Arquivo');
    updateChat(chatId, {
      ultima_mensagem: previewText.substring(0, 200),
      ultima_msg_at: new Date().toISOString(),
    });
  }, [sendMedia, updateChat]);

  const handleReact = useCallback((chatId: number, mensagemId: number, emoji: string) => {
    reactToMessage(chatId, mensagemId, emoji);
  }, [reactToMessage]);

  // Processar reacoes SSE
  const lastReacaoRef = useRef<string>('');
  useEffect(() => {
    if (!sseReacao) return;
    const key = `${sseReacao.mensagem_id}-${JSON.stringify(sseReacao.reacoes)}`;
    if (key === lastReacaoRef.current) return;
    lastReacaoRef.current = key;

    if (selectedChatRef.current && selectedChatRef.current.id === sseReacao.chat_id) {
      updateMessageReacoes(sseReacao.mensagem_id, sseReacao.reacoes);
    }
  }, [sseReacao, updateMessageReacoes]);

  const handleBack = useCallback(() => {
    setSelectedChat(null);
  }, []);

  return (
    <div className="absolute top-0 left-0 right-0 bottom-16 z-[9998] bg-white dark:bg-black shadow-2xl flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="h-12 bg-gray-900 dark:bg-white flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-2">
          {selectedChat && (
            <button
              onClick={handleBack}
              className="text-white/80 dark:text-gray-400 hover:text-white dark:hover:text-gray-900 transition-colors mr-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <svg className="w-5 h-5 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-1m0-3V6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2h-4l-4 4V10H7a2 2 0 01-2-2z" />
          </svg>
          <span className="text-white dark:text-gray-900 font-semibold text-sm">
            {selectedChat ? selectedChat.outro_nome : 'Chat Interno'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 dark:text-gray-400 hover:text-white dark:hover:text-gray-900 transition-colors"
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
          onSendMedia={handleSendMedia}
          onReact={handleReact}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <OperatorList
            currentUserId={userId}
            onSelect={handleSelectOperador}
          />
          <div className="border-t border-gray-200 dark:border-gray-800">
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
