'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ChatInterno, ChatInternoMensagem } from '@/lib/types';
import { useSSE } from '@/hooks/useSSE';
import { useChatInterno, useChatInternoMensagens } from '@/hooks/useChatInterno';
import { playNotificationBeep } from '@/lib/notification';
import { showDesktopNotification } from '@/lib/desktop-notification';
import Header from '@/components/layout/Header';
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

  return (
    <>
      <Header busca={busca} onBuscaChange={setBusca} presenca={operatorStatus as 'disponivel' | 'pausa' | 'ausente' | 'offline'} onPresencaChange={setOperatorStatus} />
      <div className="flex flex-1 min-h-0">
        {/* Painel esquerdo: operadores + chats */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 bg-white dark:bg-black overflow-y-auto">
          <OperatorList
            currentUserId={userId}
            onSelect={handleSelectOperador}
          />
          <div className="border-t border-gray-200 dark:border-gray-700">
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
