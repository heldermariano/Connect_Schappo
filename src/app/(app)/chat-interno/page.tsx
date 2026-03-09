'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ChatInterno, ChatInternoMensagem } from '@/lib/types';
import { useSSE } from '@/hooks/useSSE';
import { useChatInterno, useChatInternoMensagens } from '@/hooks/useChatInterno';
import { playNotificationBeep } from '@/lib/notification';
import { showDesktopNotification } from '@/lib/desktop-notification';
import Header from '@/components/layout/Header';
import type { StatusPresenca } from '@/components/ui/StatusBadge';
import OperatorList from '@/components/chat-interno/OperatorList';
import ChatInternoList from '@/components/chat-interno/ChatInternoList';
import ChatInternoView from '@/components/chat-interno/ChatInternoView';
import { useAppContext } from '@/contexts/AppContext';

export default function ChatInternoPage() {
  const { data: session } = useSession();
  const { operatorStatus, setOperatorStatus } = useAppContext();
  const [selectedChat, setSelectedChat] = useState<ChatInterno | null>(null);
  const [busca, setBusca] = useState('');

  const userId = session?.user?.id ? parseInt(session.user.id as string) : 0;
  const { chats, criarChat, updateChat } = useChatInterno();
  const { mensagens, loading: loadingMsgs, addMensagem, sendMensagem } = useChatInternoMensagens(selectedChat?.id ?? null);

  const handleSelectOperador = useCallback(async (operador: { id: number; nome: string }) => {
    // Buscar ou criar chat com este operador
    const chat = await criarChat(operador.id);
    if (chat) {
      setSelectedChat(chat);
    }
  }, [criarChat]);

  const handleSelectChat = useCallback((chat: ChatInterno) => {
    setSelectedChat(chat);
  }, []);

  const handleSend = useCallback((chatId: number, conteudo: string) => {
    sendMensagem(chatId, conteudo);
    updateChat(chatId, {
      ultima_mensagem: conteudo.substring(0, 200),
      ultima_msg_at: new Date().toISOString(),
    });
  }, [sendMensagem, updateChat]);

  // Handler SSE para mensagens do chat interno
  const handleSSE = useCallback((event: string, data: unknown) => {
    if (event === 'chat_interno_mensagem') {
      const d = data as { chat_id: number; mensagem: ChatInternoMensagem; destinatario_id: number };

      // Se a mensagem e para mim
      if (d.destinatario_id === userId) {
        // Atualizar chat na lista
        updateChat(d.chat_id, {
          ultima_mensagem: d.mensagem.conteudo?.substring(0, 200),
          ultima_msg_at: d.mensagem.created_at,
          nao_lidas: (selectedChat?.id === d.chat_id) ? 0 : undefined,
        });

        // Se o chat esta aberto, adicionar mensagem
        if (selectedChat && selectedChat.id === d.chat_id) {
          addMensagem(d.mensagem);
        } else {
          // Notificar
          playNotificationBeep();
          showDesktopNotification(
            d.mensagem.nome_remetente || 'Operador',
            d.mensagem.conteudo || 'Nova mensagem interna',
          );
        }
      }
    }
  }, [userId, selectedChat, addMensagem, updateChat]);

  useSSE(handleSSE);

  const { isMobile } = useAppContext();

  // Mobile: lista OU detalhe
  if (isMobile) {
    if (selectedChat) {
      return (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header com botao voltar */}
          <div className="h-12 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 flex items-center px-3 gap-2 shrink-0">
            <button onClick={() => setSelectedChat(null)} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{selectedChat.outro_nome}</span>
          </div>
          <ChatInternoView
            chat={selectedChat}
            mensagens={mensagens}
            loading={loadingMsgs}
            currentUserId={userId}
            onSend={handleSend}
          />
        </div>
      );
    }

    return (
      <>
        <Header busca={busca} onBuscaChange={setBusca} presenca={operatorStatus as StatusPresenca} onPresencaChange={setOperatorStatus} />
        <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-black overflow-y-auto">
          <OperatorList currentUserId={userId} onSelect={handleSelectOperador} />
          <div className="border-t border-gray-200 dark:border-gray-800">
            <ChatInternoList chats={chats} activeId={null} onSelect={handleSelectChat} />
          </div>
        </div>
      </>
    );
  }

  // Desktop: layout lado-a-lado
  return (
    <>
      <Header busca={busca} onBuscaChange={setBusca} presenca={operatorStatus as StatusPresenca} onPresencaChange={setOperatorStatus} />
      <div className="flex flex-1 min-h-0">
        {/* Painel esquerdo: operadores + chats */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 bg-white dark:bg-black overflow-y-auto">
          <OperatorList
            currentUserId={userId}
            onSelect={handleSelectOperador}
          />
          <div className="border-t border-gray-200 dark:border-gray-800">
            <ChatInternoList
              chats={chats}
              activeId={selectedChat?.id ?? null}
              onSelect={handleSelectChat}
            />
          </div>
        </div>

        {/* Painel central: mensagens */}
        <ChatInternoView
          chat={selectedChat}
          mensagens={mensagens}
          loading={loadingMsgs}
          currentUserId={userId}
          onSend={handleSend}
        />
      </div>
    </>
  );
}
