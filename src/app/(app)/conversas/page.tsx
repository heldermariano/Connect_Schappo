'use client';

import { useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Conversa, Mensagem, Chamada } from '@/lib/types';
import Header from '@/components/layout/Header';
import CategoryFilter from '@/components/filters/CategoryFilter';
import ConversaList from '@/components/chat/ConversaList';
import MessageView from '@/components/chat/MessageView';
import CallAlert from '@/components/calls/CallAlert';
import { useSSE } from '@/hooks/useSSE';
import { useConversas } from '@/hooks/useConversas';
import { useMensagens } from '@/hooks/useMensagens';
import { useAppContext } from '@/contexts/AppContext';
import { playNotificationBeep, showMentionToast } from '@/lib/notification';

export default function ConversasPage() {
  const { data: session } = useSession();
  const { operatorStatus, setOperatorStatus } = useAppContext();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('');
  const [selectedConversa, setSelectedConversa] = useState<Conversa | null>(null);
  const [activeCalls, setActiveCalls] = useState<Chamada[]>([]);
  // Set de conversa_ids onde o atendente foi mencionado (nao lidas)
  const [mencionadoEm, setMencionadoEm] = useState<Set<number>>(new Set());
  // Mapa de nomes de grupo por conversa_id (para toast)
  const groupNamesRef = useRef<Map<number, string>>(new Map());

  // Derivar filtros do seletor
  const filterParams = (() => {
    switch (filtro) {
      case 'individual':
        return { tipo: 'individual' };
      case 'grupo-eeg':
        return { tipo: 'grupo', categoria: 'eeg' };
      case 'grupo-recepcao':
        return { tipo: 'grupo', categoria: 'recepcao' };
      default:
        return {};
    }
  })();

  const { conversas, loading, updateConversa, refresh, marcarComoLida } = useConversas({
    ...filterParams,
    busca: busca || undefined,
  });

  // Cachear nomes de grupo
  conversas.forEach((c) => {
    if (c.tipo === 'grupo' && c.nome_grupo) {
      groupNamesRef.current.set(c.id, c.nome_grupo);
    }
  });

  const {
    mensagens,
    loading: loadingMsgs,
    hasMore,
    loadMore,
    addMensagem,
    sendMensagem,
  } = useMensagens(selectedConversa?.id ?? null);

  const userPhone = session?.user?.telefone;

  // Verifica se o telefone do atendente esta nas mencoes
  const isMentioned = useCallback(
    (mencoes: string[]): boolean => {
      if (!userPhone || !mencoes || mencoes.length === 0) return false;
      const cleanPhone = userPhone.replace(/\D/g, '');
      return mencoes.some((m) => {
        const cleanM = m.replace(/\D/g, '');
        return cleanM === cleanPhone || cleanM.endsWith(cleanPhone) || cleanPhone.endsWith(cleanM);
      });
    },
    [userPhone],
  );

  // Handler SSE
  const handleSSE = useCallback(
    (event: string, data: unknown) => {
      if (event === 'nova_mensagem') {
        const d = data as { conversa_id: number; mensagem: Mensagem };
        if (selectedConversa && d.conversa_id === selectedConversa.id) {
          addMensagem(d.mensagem);
        }

        // Verificar mencoes
        const mencoes = d.mensagem.mencoes || [];
        if (isMentioned(mencoes)) {
          setMencionadoEm((prev) => new Set(prev).add(d.conversa_id));
          playNotificationBeep();
          const senderName = d.mensagem.sender_name || 'Alguem';
          const groupName = groupNamesRef.current.get(d.conversa_id);
          showMentionToast(senderName, groupName);
        }
      }
      if (event === 'conversa_atualizada') {
        const d = data as { conversa_id: number; ultima_msg: string; nao_lida: number };
        updateConversa(d.conversa_id, {
          ultima_mensagem: d.ultima_msg,
          nao_lida: d.nao_lida,
          ultima_msg_at: new Date().toISOString(),
        });
      }
      if (event === 'chamada_nova') {
        const d = data as { chamada: Chamada };
        setActiveCalls((prev) => [...prev, d.chamada]);
        refresh();
      }
      if (event === 'chamada_atualizada') {
        const d = data as { chamada_id: number; status: string; duracao?: number };
        if (d.status !== 'ringing') {
          setActiveCalls((prev) => prev.filter((c) => c.id !== d.chamada_id));
        }
        refresh();
      }
    },
    [selectedConversa, addMensagem, updateConversa, refresh, isMentioned],
  );

  useSSE(handleSSE);

  const handleSelectConversa = (conversa: Conversa) => {
    setSelectedConversa(conversa);
    // Marcar como lida (local + server)
    if (conversa.nao_lida > 0) {
      marcarComoLida(conversa.id);
    }
    // Limpar badge de mencao ao abrir a conversa
    setMencionadoEm((prev) => {
      const next = new Set(prev);
      next.delete(conversa.id);
      return next;
    });
  };

  const handleSendMensagem = useCallback(
    async (conversaId: number, conteudo: string) => {
      await sendMensagem(conversaId, conteudo);
      // Atualizar conversa na lista (ultima msg e nao_lida)
      updateConversa(conversaId, {
        ultima_mensagem: conteudo.substring(0, 200),
        ultima_msg_at: new Date().toISOString(),
        nao_lida: 0,
      });
    },
    [sendMensagem, updateConversa],
  );

  const handleAtribuir = useCallback(
    (conversaId: number, atendenteId: number | null) => {
      updateConversa(conversaId, { atendente_id: atendenteId });
      if (selectedConversa && selectedConversa.id === conversaId) {
        setSelectedConversa((prev) => prev ? { ...prev, atendente_id: atendenteId } : null);
      }
    },
    [updateConversa, selectedConversa],
  );

  return (
    <>
      <Header busca={busca} onBuscaChange={setBusca} presenca={operatorStatus as 'disponivel' | 'pausa' | 'ausente' | 'offline'} onPresencaChange={setOperatorStatus} />
      <CallAlert chamadas={activeCalls} />
      <div className="flex flex-1 min-h-0">
        {/* Painel esquerdo: filtros + lista */}
        <div className="w-80 border-r border-gray-200 flex flex-col shrink-0 bg-white">
          <CategoryFilter selected={filtro} onChange={setFiltro} grupo={(session?.user as { grupo?: string })?.grupo || 'todos'} />
          <ConversaList
            conversas={conversas}
            activeId={selectedConversa?.id ?? null}
            onSelect={handleSelectConversa}
            loading={loading}
            mencionadoEm={mencionadoEm}
          />
        </div>

        {/* Painel central: mensagens */}
        <MessageView
          conversa={selectedConversa}
          mensagens={mensagens}
          loading={loadingMsgs}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onSend={handleSendMensagem}
          onMarcarLida={marcarComoLida}
          onAtribuir={handleAtribuir}
          onDialNumber={(number: string) => {
            const event = new CustomEvent('softphone-dial', { detail: { number } });
            window.dispatchEvent(event);
          }}
        />
      </div>
    </>
  );
}
