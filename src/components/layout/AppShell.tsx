'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import PauseScreen from '@/components/layout/PauseScreen';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { useSSE } from '@/hooks/useSSE';
import { requestNotificationPermission } from '@/lib/desktop-notification';
import { showToastNotification, playNotificationBeep } from '@/lib/notification';
import type { ChatInternoSSEData, ChatInternoReacaoSSEData } from '@/components/chat-interno/ChatInternoPopup';

// Importar SoftphoneFloating dinamicamente sem SSR (sip.js usa APIs do browser)
const SoftphoneFloating = dynamic(() => import('@/components/softphone/SoftphoneFloating'), {
  ssr: false,
});

const ChatInternoPopup = dynamic(() => import('@/components/chat-interno/ChatInternoPopup'), {
  ssr: false,
});

function ShellInner({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { operatorStatus, setOperatorStatus, refreshUnreadCounts, chatInternoUnread, refreshChatInternoUnread, isMobile } = useAppContext();
  const [chatInternoOpen, setChatInternoOpen] = useState(false);
  const [softphoneOpen, setSoftphoneOpen] = useState(false);
  const chatInternoOpenRef = useRef(false);
  const [chatInternoSSE, setChatInternoSSE] = useState<ChatInternoSSEData | null>(null);
  const [chatInternoReacaoSSE, setChatInternoReacaoSSE] = useState<ChatInternoReacaoSSEData | null>(null);
  const [autoOpenChat, setAutoOpenChat] = useState<{ chat_id: number; sender_id: number; sender_name: string } | null>(null);
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
        const d = data as { conversa_id: number; categoria?: string; tipo?: string; mensagem: { from_me: boolean; sender_name?: string; conteudo?: string; tipo_mensagem?: string } };
        if (!d.mensagem.from_me && operatorStatusRef.current === 'disponivel') {
          // Filtrar notificacoes por grupo de atendimento e categoria
          const userGrupo = (session?.user as { grupo?: string })?.grupo || 'todos';
          const isGrupo = d.tipo === 'grupo';
          const categoriaMsg = d.categoria || '';

          // Mapa de categorias permitidas por grupo
          const categoriasPermitidas: Record<string, string[]> = {
            recepcao: ['recepcao', 'geral'],
            eeg: ['eeg'],
            todos: ['eeg', 'recepcao', 'geral'],
          };
          const permitidas = categoriasPermitidas[userGrupo] || categoriasPermitidas.todos;
          const pertenceAoGrupo = !categoriaMsg || permitidas.includes(categoriaMsg);

          // Recepcao: nao notifica mensagens de grupo
          if (!pertenceAoGrupo || (userGrupo === 'recepcao' && isGrupo)) {
            // skip — categoria nao pertence ao grupo do operador
          } else {
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
            }, canal, isGrupo);
          }
        }
      }

      // Chat interno: reacoes SSE
      if (event === 'chat_interno_reacao') {
        const d = data as ChatInternoReacaoSSEData;
        if (d.destinatario_id === userId && chatInternoOpenRef.current) {
          setChatInternoReacaoSSE({ ...d });
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
            // Auto-abrir popup direto na conversa do remetente
            playNotificationBeep();
            setAutoOpenChat({
              chat_id: d.chat_id,
              sender_id: d.mensagem.atendente_id,
              sender_name: d.mensagem.nome_remetente || 'Operador',
            });
            setSoftphoneOpen(false);
            setChatInternoOpen(true);
            // Repassar SSE para o popup processar a mensagem
            setChatInternoSSE({ ...d });
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
    <div className="flex h-screen overflow-hidden">
      {['pausa', 'almoco', 'cafe', 'lanche'].includes(operatorStatus) && (
        <PauseScreen status={operatorStatus as 'pausa' | 'almoco' | 'cafe' | 'lanche'} onResume={handleResume} />
      )}
      <Sidebar />
      <div className={`flex-1 w-0 flex flex-col min-h-0 overflow-hidden ${isMobile ? 'pb-bottom-nav' : ''}`}>
        {children}
      </div>

      {/* TODO: Reativar softphone + chat interno quando estiverem estáveis */}
      {/* Painel direito (softphone/chat) desabilitado temporariamente */}

      {/* Mobile: BottomNav (sem softphone/chat por enquanto) */}
      {isMobile && (
        <BottomNav
          onOpenSoftphone={() => {}}
          onOpenChatInterno={() => {}}
        />
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
