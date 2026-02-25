'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { useSSE } from '@/hooks/useSSE';
import { requestNotificationPermission } from '@/lib/desktop-notification';
import { showToastNotification, playNotificationBeep } from '@/lib/notification';
import type { ChatInternoSSEData } from '@/components/chat-interno/ChatInternoPopup';

// Importar Softphone dinamicamente sem SSR (sip.js usa APIs do browser)
const Softphone = dynamic(() => import('@/components/softphone/Softphone'), {
  ssr: false,
  loading: () => (
    <div className="w-72 shrink-0 border-l border-gray-200 bg-white flex flex-col">
      <div className="h-14 flex items-center justify-center border-b border-gray-200 bg-gray-900">
        <span className="text-sm font-semibold text-white/50">Telefone</span>
      </div>
    </div>
  ),
});

const ChatInternoPopup = dynamic(() => import('@/components/chat-interno/ChatInternoPopup'), {
  ssr: false,
});

function ShellInner({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { operatorStatus, refreshUnreadCounts, chatInternoUnread, refreshChatInternoUnread } = useAppContext();
  const [chatInternoOpen, setChatInternoOpen] = useState(false);
  const chatInternoOpenRef = useRef(false);
  const [chatInternoSSE, setChatInternoSSE] = useState<ChatInternoSSEData | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const userId = session?.user?.id ? parseInt(session.user.id as string) : 0;

  // Manter ref sincronizada com state
  useEffect(() => {
    chatInternoOpenRef.current = chatInternoOpen;
  }, [chatInternoOpen]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // SSE global para atualizar badges e toasts
  const handleGlobalSSE = useCallback(
    (event: string, data: unknown) => {
      if (event === 'nova_mensagem' || event === 'conversa_atualizada') {
        refreshUnreadCounts();
      }

      // Toast para nova mensagem WhatsApp (se nao estiver na conversa ativa)
      if (event === 'nova_mensagem') {
        const d = data as { conversa_id: number; mensagem: { from_me: boolean; sender_name?: string; conteudo?: string; tipo_mensagem?: string } };
        if (!d.mensagem.from_me) {
          const senderName = d.mensagem.sender_name || 'Contato';
          const preview = d.mensagem.conteudo
            ? d.mensagem.conteudo.substring(0, 80)
            : d.mensagem.tipo_mensagem === 'image' ? 'Imagem'
            : d.mensagem.tipo_mensagem === 'audio' ? 'Audio'
            : d.mensagem.tipo_mensagem === 'video' ? 'Video'
            : d.mensagem.tipo_mensagem === 'document' ? 'Documento'
            : 'Nova mensagem';

          // So mostra toast se nao estiver na pagina de conversas com essa conversa ativa
          playNotificationBeep();
          showToastNotification(senderName, preview, () => {
            router.push(`/conversas?open=${d.conversa_id}`);
          });
        }
      }

      // Chat interno: toast + badge + repassar ao popup
      if (event === 'chat_interno_mensagem') {
        const d = data as ChatInternoSSEData;
        if (d.destinatario_id === userId) {
          refreshChatInternoUnread();

          if (chatInternoOpenRef.current) {
            // Repassar ao popup para atualizar mensagens em tempo real
            setChatInternoSSE({ ...d });
          } else {
            // Toast apenas se popup nao estiver aberto
            const senderName = d.mensagem.nome_remetente || 'Operador';
            const preview = d.mensagem.conteudo?.substring(0, 80) || 'Nova mensagem';
            playNotificationBeep();
            showToastNotification(senderName, preview, () => {
              setChatInternoOpen(true);
            });
          }
        }
      }
    },
    [refreshUnreadCounts, refreshChatInternoUnread, userId, router],
  );

  useSSE(handleGlobalSSE);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
      <Softphone operatorStatus={operatorStatus} />

      {/* Icone flutuante do chat interno */}
      <button
        onClick={() => setChatInternoOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-[9997] w-14 h-14 bg-schappo-500 hover:bg-schappo-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Chat Interno"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-1m0-3V6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2h-4l-4 4V10H7a2 2 0 01-2-2z" />
        </svg>
        {chatInternoUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm">
            {chatInternoUnread > 99 ? '99+' : chatInternoUnread}
          </span>
        )}
      </button>

      {/* Popup do chat interno */}
      {chatInternoOpen && (
        <ChatInternoPopup onClose={() => setChatInternoOpen(false)} sseMessage={chatInternoSSE} />
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <ShellInner>{children}</ShellInner>
    </AppProvider>
  );
}
