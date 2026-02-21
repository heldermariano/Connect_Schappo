'use client';

import { useState, useCallback } from 'react';
import { Conversa, Mensagem } from '@/lib/types';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CategoryFilter from '@/components/filters/CategoryFilter';
import ConversaList from '@/components/chat/ConversaList';
import MessageView from '@/components/chat/MessageView';
import { useSSE } from '@/hooks/useSSE';
import { useConversas } from '@/hooks/useConversas';
import { useMensagens } from '@/hooks/useMensagens';

export default function ConversasPage() {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('');
  const [selectedConversa, setSelectedConversa] = useState<Conversa | null>(null);

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

  const { conversas, loading, updateConversa, refresh } = useConversas({
    ...filterParams,
    busca: busca || undefined,
  });

  const {
    mensagens,
    loading: loadingMsgs,
    hasMore,
    loadMore,
    addMensagem,
  } = useMensagens(selectedConversa?.id ?? null);

  // Handler SSE
  const handleSSE = useCallback(
    (event: string, data: unknown) => {
      if (event === 'nova_mensagem') {
        const d = data as { conversa_id: number; mensagem: Mensagem };
        if (selectedConversa && d.conversa_id === selectedConversa.id) {
          addMensagem(d.mensagem);
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
      if (event === 'chamada_nova' || event === 'chamada_atualizada') {
        // Atualizar lista de conversas para refletir eventos de chamada
        refresh();
      }
    },
    [selectedConversa, addMensagem, updateConversa, refresh],
  );

  useSSE(handleSSE);

  const handleSelectConversa = (conversa: Conversa) => {
    setSelectedConversa(conversa);
    // Marcar como lida localmente
    if (conversa.nao_lida > 0) {
      updateConversa(conversa.id, { nao_lida: 0 });
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header busca={busca} onBuscaChange={setBusca} />
        <div className="flex flex-1 min-h-0">
          {/* Painel esquerdo: filtros + lista */}
          <div className="w-80 border-r border-gray-200 flex flex-col shrink-0 bg-white">
            <CategoryFilter selected={filtro} onChange={setFiltro} />
            <ConversaList
              conversas={conversas}
              activeId={selectedConversa?.id ?? null}
              onSelect={handleSelectConversa}
              loading={loading}
            />
          </div>

          {/* Painel direito: mensagens */}
          <MessageView
            conversa={selectedConversa}
            mensagens={mensagens}
            loading={loadingMsgs}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        </div>
      </div>
    </div>
  );
}
