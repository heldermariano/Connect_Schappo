'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import PauseScreen from '@/components/layout/PauseScreen';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { useSSE } from '@/hooks/useSSE';
import { requestNotificationPermission } from '@/lib/desktop-notification';
import { showToastNotification, playNotificationBeep } from '@/lib/notification';
import type { ChatInternoSSEData } from '@/components/chat-interno/ChatInternoPopup';

// Importar SoftphoneFloating dinamicamente sem SSR (sip.js usa APIs do browser)
const SoftphoneFloating = dynamic(() => import('@/components/softphone/SoftphoneFloating'), {
  ssr: false,
});

const ChatInternoPopup = dynamic(() => import('@/components/chat-interno/ChatInternoPopup'), {
  ssr: false,
});

function ShellInner({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { operatorStatus, setOperatorStatus, refreshUnreadCounts, chatInternoUnread, refreshChatInternoUnread } = useAppContext();
  const [chatInternoOpen, setChatInternoOpen] = useState(false);
  const [softphoneOpen, setSoftphoneOpen] = useState(false);
  const chatInternoOpenRef = useRef(false);
  const [chatInternoSSE, setChatInternoSSE] = useState<ChatInternoSSEData | null>(null);
  const router = useRouter();
  const userId = session?.user?.id ? parseInt(session.user.id as string) : 0;
  const operatorStatusRef = useRef(operatorStatus);
  useEffect(() => { operatorStatusRef.current = operatorStatus; }, [operatorStatus]);

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
        const d = data as { conversa_id: number; categoria?: string; mensagem: { from_me: boolean; sender_name?: string; conteudo?: string; tipo_mensagem?: string } };
        if (!d.mensagem.from_me && operatorStatusRef.current === 'disponivel') {
          const senderName = d.mensagem.sender_name || 'Contato';
          const preview = d.mensagem.conteudo
            ? d.mensagem.conteudo.substring(0, 80)
            : d.mensagem.tipo_mensagem === 'image' ? 'Imagem'
            : d.mensagem.tipo_mensagem === 'audio' ? 'Audio'
            : d.mensagem.tipo_mensagem === 'video' ? 'Video'
            : d.mensagem.tipo_mensagem === 'document' ? 'Documento'
            : 'Nova mensagem';

          const canal = d.categoria || '';
          playNotificationBeep();
          showToastNotification(senderName, preview, () => {
            router.push(`/conversas?canal=${canal}&id=${d.conversa_id}`);
          }, canal);
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
          } else if (operatorStatusRef.current === 'disponivel') {
            // Toast apenas se popup nao estiver aberto e operador disponivel
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

  const handleResume = useCallback(async () => {
    setOperatorStatus('disponivel');
    try {
      await fetch('/api/atendentes/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'disponivel' }),
      });
    } catch (err) {
      console.error('Erro ao retomar status:', err);
    }
  }, [setOperatorStatus]);

  return (
    <div className="flex h-screen">
      {(operatorStatus === 'pausa' || operatorStatus === 'ausente') && (
        <PauseScreen status={operatorStatus as 'pausa' | 'ausente'} onResume={handleResume} />
      )}
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>

      {/* Coluna direita para softphone + chat interno */}
      <div className="w-80 shrink-0 flex flex-col">
        {/* Continuar barra laranja do header (sem border) */}
        <div className="h-14 bg-schappo-500 shrink-0" />
        {/* Area de conteudo abaixo do header */}
        <div className="flex-1 relative bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Softphone panel */}
          <SoftphoneFloating operatorStatus={operatorStatus} open={softphoneOpen} onToggle={() => setSoftphoneOpen((p) => !p)} />

          {/* Botoes telefone + chat lado a lado no rodape */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-[9997]">
            {/* Botao telefone */}
            <button
              data-softphone-toggle
              onClick={() => { setSoftphoneOpen((p) => !p); setChatInternoOpen(false); }}
              className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 text-white ${
                softphoneOpen ? 'bg-schappo-600' : 'bg-gray-800 hover:bg-gray-700'
              }`}
              title="Telefone"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>

            {/* Botao chat interno */}
            <button
              onClick={() => { setChatInternoOpen((prev) => !prev); setSoftphoneOpen(false); }}
              className="w-11 h-11 bg-schappo-500 hover:bg-schappo-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 relative"
              title="Chat Interno"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-1m0-3V6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2h-4l-4 4V10H7a2 2 0 01-2-2z" />
              </svg>
              {chatInternoUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold shadow-sm">
                  {chatInternoUnread > 99 ? '99+' : chatInternoUnread}
                </span>
              )}
            </button>
          </div>

          {/* Popup do chat interno */}
          {chatInternoOpen && (
            <ChatInternoPopup onClose={() => setChatInternoOpen(false)} sseMessage={chatInternoSSE} />
          )}
        </div>
      </div>
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
