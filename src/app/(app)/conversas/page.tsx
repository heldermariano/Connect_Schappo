'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Conversa, Mensagem, Chamada } from '@/lib/types';
import Header from '@/components/layout/Header';
import CategoryFilter from '@/components/filters/CategoryFilter';
import ConversaList from '@/components/chat/ConversaList';
import MessageView from '@/components/chat/MessageView';
import CallAlert from '@/components/calls/CallAlert';
import GrupoListModal from '@/components/chat/GrupoListModal';
import { useSSE } from '@/hooks/useSSE';
import { useConversas } from '@/hooks/useConversas';
import { useMensagens } from '@/hooks/useMensagens';
import { useAppContext } from '@/contexts/AppContext';
import { playNotificationBeep, showMentionToast } from '@/lib/notification';
import { showDesktopNotification } from '@/lib/desktop-notification';

export default function ConversasPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { operatorStatus, setOperatorStatus } = useAppContext();
  const [busca, setBusca] = useState('');
  const [buscaPainel, setBuscaPainel] = useState('');
  const [filtro, setFiltro] = useState('');
  const [selectedConversa, setSelectedConversa] = useState<Conversa | null>(null);
  const [showGrupoList, setShowGrupoList] = useState(false);
  const [activeCalls, setActiveCalls] = useState<Chamada[]>([]);
  // Set de conversa_ids onde o atendente foi mencionado (nao lidas)
  const [mencionadoEm, setMencionadoEm] = useState<Set<number>>(new Set());
  // Set de conversa_ids com flash visual (nova msg recebida)
  const [flashingConversas, setFlashingConversas] = useState<Set<number>>(new Set());
  // Set de conversa_ids urgentes (10+ min sem resposta)
  const [urgentConversas, setUrgentConversas] = useState<Set<number>>(new Set());
  // IDs já alertados via desktop notification (evita repetir)
  const alertedIdsRef = useRef<Set<number>>(new Set());
  // Mapa de nomes de grupo por conversa_id (para toast)
  const groupNamesRef = useRef<Map<number, string>>(new Map());
  // Track se ja processou o query param ?id
  const processedIdRef = useRef<string | null>(null);

  // Canal selecionado via searchParams
  const canal = searchParams.get('canal');
  const prevCanalRef = useRef<string | null>(canal);

  // Reset filtro e busca quando canal muda — default 'individual' (nao tem "Todos")
  useEffect(() => {
    if (canal !== prevCanalRef.current) {
      setFiltro(canal ? 'individual' : '');
      setBuscaPainel('');
      prevCanalRef.current = canal;
    }
  }, [canal]);

  // Derivar filtros do seletor
  const filterParams = useMemo(() => {
    if (canal) {
      if (filtro === 'pendentes') {
        return { categoria: canal, pendentes: 'true' };
      }
      const tipo = filtro === 'grupo' ? 'grupo' : 'individual';
      return { categoria: canal, tipo };
    }
    // Sem canal: comportamento original
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
  }, [canal, filtro]);

  const { conversas, loading, updateConversa, refresh, marcarComoLida } = useConversas({
    ...filterParams,
    busca: buscaPainel || undefined,
  });

  // Cachear nomes de grupo
  conversas.forEach((c) => {
    if (c.tipo === 'grupo' && c.nome_grupo) {
      groupNamesRef.current.set(c.id, c.nome_grupo);
    }
  });

  // Pre-selecionar conversa via query param ?id=X
  const paramId = searchParams.get('id');
  useEffect(() => {
    if (!paramId || paramId === processedIdRef.current || loading) return;
    const id = parseInt(paramId, 10);
    if (isNaN(id)) return;

    // Tentar encontrar na lista atual
    // Preservar ?canal= ao limpar ?id
    const baseUrl = canal ? `/conversas?canal=${canal}` : '/conversas';
    const found = conversas.find((c) => c.id === id);
    if (found) {
      setSelectedConversa(found);
      if (found.nao_lida > 0) marcarComoLida(found.id);
      processedIdRef.current = paramId;
      window.history.replaceState({}, '', baseUrl);
    } else if (!loading && conversas.length > 0) {
      // Conversa pode nao estar nos filtros atuais — buscar diretamente
      fetch(`/api/conversas?id=${id}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.conversas?.length > 0) {
            setSelectedConversa(data.conversas[0]);
            processedIdRef.current = paramId;
            window.history.replaceState({}, '', baseUrl);
          }
        })
        .catch(() => {});
    }
  }, [paramId, conversas, loading, marcarComoLida, canal]);

  const {
    mensagens,
    loading: loadingMsgs,
    hasMore,
    loadMore,
    addMensagem,
    removeMensagem,
    updateMensagem,
    sendMensagem,
    editMensagem,
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

        // Notificacao para mensagens recebidas (nao enviadas pelo atendente)
        if (!d.mensagem.from_me) {
          // Pular notificacao se a conversa esta selecionada E pagina tem foco
          const isActiveAndFocused = selectedConversa && d.conversa_id === selectedConversa.id && document.hasFocus();
          if (!isActiveAndFocused) {
            // So notificar se operador estiver disponivel
            if (operatorStatus === 'disponivel') {
              playNotificationBeep();
              const senderName = d.mensagem.sender_name || 'Paciente';
              const groupName = groupNamesRef.current.get(d.conversa_id);
              const notifTitle = groupName ? `${senderName} em ${groupName}` : senderName;
              const notifBody = d.mensagem.conteudo || 'Nova mensagem';
              showDesktopNotification(notifTitle, notifBody);
            }

            // Flash visual na conversa (sempre, para nao perder indicacao)
            setFlashingConversas((prev) => new Set(prev).add(d.conversa_id));
            setTimeout(() => {
              setFlashingConversas((prev) => {
                const next = new Set(prev);
                next.delete(d.conversa_id);
                return next;
              });
            }, 2000);
          }
        }

        // Verificar mencoes
        const mencoes = d.mensagem.mencoes || [];
        if (isMentioned(mencoes)) {
          setMencionadoEm((prev) => new Set(prev).add(d.conversa_id));
          if (operatorStatus === 'disponivel') {
            playNotificationBeep();
            const senderName = d.mensagem.sender_name || 'Alguem';
            const groupName = groupNamesRef.current.get(d.conversa_id);
            showMentionToast(senderName, groupName);
          }
        }
      }
      if (event === 'conversa_atualizada') {
        const d = data as { conversa_id: number; ultima_msg: string; nao_lida: number; atendente_id?: number | null; atendente_nome?: string | null; ultima_msg_from_me?: boolean };
        const updates: Partial<Conversa> = {
          ultima_mensagem: d.ultima_msg,
          nao_lida: d.nao_lida,
          ultima_msg_at: new Date().toISOString(),
        };
        if (d.atendente_id !== undefined) {
          updates.atendente_id = d.atendente_id;
        }
        if (d.ultima_msg_from_me !== undefined) {
          updates.ultima_msg_from_me = d.ultima_msg_from_me;
        }
        updateConversa(d.conversa_id, updates);
        // Atualizar conversa selecionada se for a mesma
        if (selectedConversa && selectedConversa.id === d.conversa_id && d.atendente_id !== undefined) {
          setSelectedConversa((prev) => prev ? { ...prev, atendente_id: d.atendente_id ?? null, ...(d.atendente_nome !== undefined ? { atendente_nome: d.atendente_nome } : {}) } as Conversa : null);
        }
      }
      if (event === 'mensagem_editada') {
        const d = data as { conversa_id: number; mensagem: Mensagem };
        if (selectedConversa && d.conversa_id === selectedConversa.id && d.mensagem) {
          updateMensagem(d.mensagem.id, {
            conteudo: d.mensagem.conteudo,
            is_edited: true,
            edited_at: d.mensagem.edited_at,
          });
        }
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
    [selectedConversa, addMensagem, updateMensagem, updateConversa, refresh, isMentioned, operatorStatus],
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

  const userId = session?.user?.id ? parseInt(session.user.id as string) : null;

  const handleSendMensagem = useCallback(
    async (conversaId: number, conteudo: string, mencoes?: string[], quotedMsgId?: string) => {
      // Auto-atribuir se nao atribuida
      if (selectedConversa && selectedConversa.atendente_id === null && userId) {
        try {
          await fetch(`/api/conversas/${conversaId}/atribuir`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ atendente_id: userId }),
          });
          updateConversa(conversaId, { atendente_id: userId });
          setSelectedConversa((prev) =>
            prev ? { ...prev, atendente_id: userId } : null,
          );
        } catch (err) {
          console.error('[conversas] Erro ao auto-atribuir:', err);
        }
      }

      await sendMensagem(conversaId, conteudo, mencoes, quotedMsgId);
      // Atualizar conversa na lista (ultima msg e nao_lida)
      updateConversa(conversaId, {
        ultima_mensagem: conteudo.substring(0, 200),
        ultima_msg_at: new Date().toISOString(),
        ultima_msg_from_me: true,
        nao_lida: 0,
      });
    },
    [sendMensagem, updateConversa, selectedConversa, userId],
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

  // Menu de contexto: marcar como nao lida / lida
  const handleMarkUnread = useCallback(
    async (conversaId: number) => {
      const conv = conversas.find((c) => c.id === conversaId);
      if (!conv) return;
      if (conv.nao_lida > 0) {
        marcarComoLida(conversaId);
      } else {
        // Marcar como nao lida
        try {
          await fetch(`/api/conversas/${conversaId}/read`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unread: true }),
          });
          updateConversa(conversaId, { nao_lida: 1 });
        } catch (err) {
          console.error('[conversas] Erro ao marcar como nao lida:', err);
        }
      }
    },
    [conversas, marcarComoLida, updateConversa],
  );

  // Menu de contexto: marcar como resolvida (finalizar)
  const handleMarkResolved = useCallback(
    async (conversaId: number) => {
      const conv = conversas.find((c) => c.id === conversaId);
      if (!conv) return;
      try {
        await fetch(`/api/conversas/${conversaId}/atribuir`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ atendente_id: null }),
        });
        if (selectedConversa?.id === conversaId) {
          setSelectedConversa(null);
        }
        refresh();
      } catch (err) {
        console.error('[conversas] Erro ao resolver conversa:', err);
      }
    },
    [conversas, selectedConversa, refresh],
  );

  const handleFinalizar = useCallback(
    async (conversaId: number) => {
      try {
        await fetch(`/api/conversas/${conversaId}/atribuir`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ atendente_id: null }),
        });
        // Conversa foi arquivada — remover da lista e limpar selecao
        setSelectedConversa(null);
        refresh();
      } catch (err) {
        console.error('[conversas] Erro ao finalizar atendimento:', err);
      }
    },
    [updateConversa, refresh],
  );

  const handleDeleteConversa = useCallback(
    async (conversaId: number) => {
      try {
        const res = await fetch(`/api/conversas/${conversaId}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error || 'Erro ao excluir conversa');
          return;
        }
        // Remover da lista e limpar selecao
        refresh();
        setSelectedConversa(null);
      } catch (err) {
        console.error('[conversas] Erro ao excluir conversa:', err);
        alert('Erro ao excluir conversa');
      }
    },
    [refresh],
  );

  const handleEditMensagem = useCallback(
    async (conversaId: number, msgId: number, conteudo: string) => {
      await editMensagem(conversaId, msgId, conteudo);
    },
    [editMensagem],
  );

  const handleDeleteMensagem = useCallback(
    async (conversaId: number, msgId: number) => {
      try {
        const res = await fetch(`/api/mensagens/${conversaId}/${msgId}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error || 'Erro ao excluir mensagem');
          return;
        }
        removeMensagem(msgId);
      } catch (err) {
        console.error('[conversas] Erro ao excluir mensagem:', err);
        alert('Erro ao excluir mensagem');
      }
    },
    [removeMensagem],
  );

  const userRole = (session?.user as { role?: string })?.role;

  // Alerta de urgência: conversas individuais sem resposta há 10+ min
  useEffect(() => {
    const TEN_MINUTES = 10 * 60 * 1000;

    const checkUrgent = () => {
      const now = Date.now();
      const newUrgent = new Set<number>();

      for (const c of conversas) {
        if (
          c.tipo === 'individual' &&
          c.nao_lida > 0 &&
          !c.ultima_msg_from_me &&
          c.ultima_msg_at
        ) {
          const elapsed = now - new Date(c.ultima_msg_at).getTime();
          if (elapsed >= TEN_MINUTES) {
            newUrgent.add(c.id);

            // Desktop notification 1x por conversa
            if (!alertedIdsRef.current.has(c.id)) {
              alertedIdsRef.current.add(c.id);
              const nome = c.nome_contato || c.telefone || 'Paciente';
              const mins = Math.floor(elapsed / 60000);
              showDesktopNotification(
                `Atendimento urgente`,
                `${nome} aguarda resposta há ${mins} minutos`,
              );
            }
          }
        }
      }

      setUrgentConversas(newUrgent);

      // Limpar alertas de conversas que foram respondidas
      alertedIdsRef.current.forEach((id) => {
        if (!newUrgent.has(id)) {
          alertedIdsRef.current.delete(id);
        }
      });
    };

    checkUrgent();
    const interval = setInterval(checkUrgent, 30000);
    return () => clearInterval(interval);
  }, [conversas]);

  // Empty state quando nenhum canal selecionado
  if (!canal) {
    return (
      <>
        <Header busca={busca} onBuscaChange={setBusca} presenca={operatorStatus as 'disponivel' | 'pausa' | 'ausente' | 'offline'} onPresencaChange={setOperatorStatus} />
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-black">
          <div className="text-center max-w-sm">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Selecione um canal</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Passe o mouse sobre o icone de conversas na barra lateral para escolher um canal WhatsApp.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header busca={busca} onBuscaChange={setBusca} presenca={operatorStatus as 'disponivel' | 'pausa' | 'ausente' | 'offline'} onPresencaChange={setOperatorStatus} />
      <CallAlert chamadas={activeCalls} />
      <div className="flex flex-1 min-h-0">
        {/* Painel esquerdo: filtros + lista */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 bg-white dark:bg-black">
          <CategoryFilter
            selected={filtro}
            onChange={setFiltro}
            grupo={(session?.user as { grupo?: string })?.grupo || 'todos'}
            canal={canal}
            busca={buscaPainel}
            onBuscaChange={setBuscaPainel}
            onListarGrupos={() => setShowGrupoList(true)}
          />
          <ConversaList
            conversas={conversas}
            activeId={selectedConversa?.id ?? null}
            onSelect={handleSelectConversa}
            loading={loading}
            mencionadoEm={mencionadoEm}
            flashingConversas={flashingConversas}
            urgentConversas={urgentConversas}
            onMarkUnread={handleMarkUnread}
            onMarkResolved={handleMarkResolved}
            onDelete={userRole === 'admin' ? handleDeleteConversa : undefined}
            isAdmin={userRole === 'admin'}
          />
        </div>

        {/* Modal listar grupos */}
        {canal && (
          <GrupoListModal
            open={showGrupoList}
            canal={canal}
            onClose={() => setShowGrupoList(false)}
            onSelectGrupo={(grupo) => {
              setShowGrupoList(false);
              setSelectedConversa(grupo);
              if (grupo.nao_lida > 0) marcarComoLida(grupo.id);
              // Mudar para tab grupo se nao estiver
              if (filtro !== 'grupo') setFiltro('grupo');
            }}
          />
        )}

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
          currentUserId={userId ?? undefined}
          onFinalizar={handleFinalizar}
          currentUserRole={userRole}
          onDeleteConversa={handleDeleteConversa}
          onDeleteMensagem={handleDeleteMensagem}
          onEditMensagem={handleEditMensagem}
        />
      </div>
    </>
  );
}
