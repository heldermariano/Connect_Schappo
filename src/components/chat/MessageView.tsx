'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Conversa, Mensagem } from '@/lib/types';
import { useAppContext } from '@/contexts/AppContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import MessageContextMenu from './MessageContextMenu';
import ReactionPicker from './ReactionPicker';
import ForwardModal from './ForwardModal';
import AtribuirDropdown from './AtribuirDropdown';
import Avatar from '@/components/ui/Avatar';
import CallButton from '@/components/calls/CallButton';
import PacienteBanner from './PacienteBanner';
import TemplateSendModal from './TemplateSendModal';
import { getDateLabel, shouldShowDateSeparator, filterMessagesBySearch } from '@/lib/message-utils';

interface MessageViewProps {
  conversa: Conversa | null;
  mensagens: Mensagem[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSend: (conversaId: number, conteudo: string, mencoes?: string[], quotedMsgId?: string) => Promise<void>;
  onMarcarLida: (conversaId: number) => void;
  onAtribuir: (conversaId: number, atendenteId: number | null) => void;
  onDialNumber?: (number: string) => void;
  currentUserId?: number;
  onFinalizar?: (conversaId: number) => void;
  currentUserRole?: string;
  onDeleteConversa?: (conversaId: number) => void;
  onDeleteMensagem?: (conversaId: number, msgId: number) => void;
  onEditMensagem?: (conversaId: number, msgId: number, conteudo: string) => Promise<void>;
  onBack?: () => void;
}

export default function MessageView({
  conversa,
  mensagens,
  loading,
  hasMore,
  onLoadMore,
  onSend,
  onMarcarLida,
  onAtribuir,
  onDialNumber,
  currentUserId,
  onFinalizar,
  currentUserRole,
  onDeleteConversa,
  onDeleteMensagem,
  onEditMensagem,
  onBack,
}: MessageViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markedReadRef = useRef<number | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; mensagem: Mensagem } | null>(null);
  // Reply state
  const [replyingTo, setReplyingTo] = useState<Mensagem | null>(null);
  // Reaction picker state
  const [reactionTarget, setReactionTarget] = useState<{ x: number; y: number; mensagem: Mensagem } | null>(null);
  // Forward modal state — agora suporta multiplas mensagens
  const [forwardingMsgs, setForwardingMsgs] = useState<Mensagem[]>([]);
  // Edit state
  const [editingMsg, setEditingMsg] = useState<Mensagem | null>(null);
  // Multi-select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<number>>(new Set());

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const msgRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Sync state (UAZAPI /chat/details)
  const [syncedName, setSyncedName] = useState<string | null>(null);
  const [syncedAvatar, setSyncedAvatar] = useState<string | null>(null);
  const [syncedMemberCount, setSyncedMemberCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Template modal (360Dialog 24h window)
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Mobile
  const { isMobile } = useAppContext();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Limpar estados ao mudar de conversa
  useEffect(() => {
    setReplyingTo(null);
    setContextMenu(null);
    setReactionTarget(null);
    setForwardingMsgs([]);
    setEditingMsg(null);
    setSelectMode(false);
    setSelectedMsgIds(new Set());
    setSyncedName(null);
    setSyncedAvatar(null);
    setSyncedMemberCount(null);
    setSearchOpen(false);
    setSearchTerm('');
    setSearchIndex(0);
  }, [conversa?.id]);

  // Track contagem anterior para distinguir nova msg vs loadMore
  const prevCountRef = useRef(0);
  const prevFirstIdRef = useRef<number | null>(null);

  // Auto-scroll para ultima mensagem (apenas quando nova msg chega no final, nao no loadMore)
  useEffect(() => {
    if (mensagens.length === 0) {
      prevCountRef.current = 0;
      prevFirstIdRef.current = null;
      return;
    }

    const firstId = mensagens[0]?.id;
    const isLoadMore = prevCountRef.current > 0 && firstId !== prevFirstIdRef.current && mensagens.length > prevCountRef.current;

    if (!isLoadMore) {
      // Nova mensagem no final ou troca de conversa — scroll para o final
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      // LoadMore (mensagens antigas no inicio) — preservar posicao do scroll
      // O containerRef mantem a posicao naturalmente pois novas msgs sao adicionadas acima
    }

    prevCountRef.current = mensagens.length;
    prevFirstIdRef.current = firstId;
  }, [mensagens]);

  // Marcar como lida ao selecionar conversa
  useEffect(() => {
    if (conversa && conversa.nao_lida > 0 && markedReadRef.current !== conversa.id) {
      markedReadRef.current = conversa.id;
      onMarcarLida(conversa.id);
    }
    if (!conversa) {
      markedReadRef.current = null;
    }
  }, [conversa, onMarcarLida]);

  const handleSend = useCallback(
    async (conteudo: string, mencoes?: string[], quotedMsgId?: string) => {
      if (!conversa) return;
      await onSend(conversa.id, conteudo, mencoes, quotedMsgId);
      setReplyingTo(null);
    },
    [conversa, onSend],
  );

  const handleContextMenu = useCallback((data: { x: number; y: number; mensagem: Mensagem }) => {
    setContextMenu(data);
    setReactionTarget(null);
  }, []);

  const handleCopy = useCallback(() => {
    if (!contextMenu) return;
    const text = contextMenu.mensagem.conteudo || '';
    navigator.clipboard.writeText(text).catch(() => {});
    setContextMenu(null);
  }, [contextMenu]);

  const handleReply = useCallback(() => {
    if (!contextMenu) return;
    setReplyingTo(contextMenu.mensagem);
    setContextMenu(null);
  }, [contextMenu]);

  const handleReact = useCallback(() => {
    if (!contextMenu) return;
    setReactionTarget({ x: contextMenu.x, y: contextMenu.y, mensagem: contextMenu.mensagem });
    setContextMenu(null);
  }, [contextMenu]);

  const handleForward = useCallback(() => {
    if (!contextMenu) return;
    setForwardingMsgs([contextMenu.mensagem]);
    setContextMenu(null);
  }, [contextMenu]);

  // Toggle selecao de uma mensagem
  const handleToggleSelect = useCallback((msgId: number) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  // Encaminhar mensagens selecionadas
  const handleForwardSelected = useCallback(() => {
    const selected = mensagens.filter((m) => selectedMsgIds.has(m.id));
    if (selected.length === 0) return;
    setForwardingMsgs(selected);
  }, [mensagens, selectedMsgIds]);

  // Sair do modo selecao
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedMsgIds(new Set());
  }, []);

  const doResend = useCallback(async (msgId: number) => {
    try {
      const res = await fetch('/api/mensagens/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem_id: msgId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('[resend] Erro:', body.error || res.status);
      }
    } catch (err) {
      console.error('[resend] Erro:', err);
    }
  }, []);

  const handleResend = useCallback(async () => {
    if (!contextMenu || !conversa) return;
    const msg = contextMenu.mensagem;
    setContextMenu(null);
    await doResend(msg.id);
  }, [contextMenu, conversa, doResend]);

  const handleEdit = useCallback(() => {
    if (!contextMenu) return;
    setEditingMsg(contextMenu.mensagem);
    setReplyingTo(null); // Mutuamente exclusivo
    setContextMenu(null);
  }, [contextMenu]);

  const handleEditSend = useCallback(async (msgId: number, conteudo: string) => {
    if (!conversa || !onEditMensagem) return;
    await onEditMensagem(conversa.id, msgId, conteudo);
    setEditingMsg(null);
  }, [conversa, onEditMensagem]);

  const handleDelete = useCallback(() => {
    if (!contextMenu || !conversa || !onDeleteMensagem) return;
    if (window.confirm('Excluir esta mensagem?')) {
      onDeleteMensagem(conversa.id, contextMenu.mensagem.id);
    }
    setContextMenu(null);
  }, [contextMenu, conversa, onDeleteMensagem]);

  const handleSendReaction = useCallback(async (emoji: string) => {
    if (!reactionTarget || !conversa) return;
    try {
      await fetch('/api/mensagens/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversa_id: conversa.id,
          wa_message_id: reactionTarget.mensagem.wa_message_id,
          emoji,
        }),
      });
    } catch (err) {
      console.error('[reaction] Erro:', err);
    }
    setReactionTarget(null);
  }, [reactionTarget, conversa]);

  // Fechar menu "mais" ao clicar fora (mobile)
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuOpen]);

  const handleSync = useCallback(async () => {
    if (!conversa || syncing) return;
    const identifier = conversa.telefone || conversa.wa_chatid;
    if (!identifier) return;

    setSyncing(true);
    try {
      const res = await fetch(`/api/contatos/${encodeURIComponent(identifier)}/sync`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.nome) setSyncedName(data.nome);
        if (data.avatar_url) setSyncedAvatar(data.avatar_url);
        if (data.member_count) setSyncedMemberCount(data.member_count);
      }
    } catch (err) {
      console.error('[sync] Erro:', err);
    } finally {
      setSyncing(false);
    }
  }, [conversa, syncing]);

  // Detectar janela de 24h expirada (360Dialog)
  const is360WindowExpired = useMemo(() => {
    if (!conversa || conversa.provider !== '360dialog' || conversa.tipo !== 'individual') return false;
    // Procurar ultima mensagem recebida (from_me = false)
    const lastReceived = [...mensagens].reverse().find((m) => !m.from_me);
    if (!lastReceived) return true; // Nenhuma mensagem recebida = janela fechada
    const receivedAt = new Date(lastReceived.created_at).getTime();
    const now = Date.now();
    return (now - receivedAt) > 24 * 60 * 60 * 1000;
  }, [conversa, mensagens]);

  // Search matches
  const searchMatches = useMemo(() => {
    return filterMessagesBySearch(mensagens, searchTerm);
  }, [mensagens, searchTerm]);

  // Scroll to current match
  useEffect(() => {
    if (searchMatches.length === 0) return;
    const match = searchMatches[searchIndex];
    if (!match) return;
    const el = msgRefs.current.get(match.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.background = '#f59e0b33';
      setTimeout(() => { el.style.background = ''; }, 1500);
    }
  }, [searchIndex, searchMatches]);

  if (!conversa) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-black text-gray-400 dark:text-gray-500 overflow-hidden">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">Selecione uma conversa para visualizar</p>
        </div>
      </div>
    );
  }

  const isGroup = conversa.tipo === 'grupo';
  const displayName = syncedName || (isGroup
    ? conversa.nome_grupo || 'Grupo'
    : conversa.nome_contato || conversa.telefone || 'Desconhecido');

  const displayAvatar = syncedAvatar || conversa.avatar_url;

  return (
    <div className="flex-1 flex flex-col w-full min-w-0 min-h-0 overflow-hidden bg-gray-50 dark:bg-black relative">
      {/* Header da conversa */}
      <div className="h-14 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 flex items-center px-3 md:px-4 gap-2 md:gap-3 shrink-0 min-w-0 overflow-visible relative z-10">
        {/* Botao voltar (mobile) */}
        {onBack && (
          <button onClick={onBack} className="p-1 -ml-1 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <Avatar nome={displayName} avatarUrl={displayAvatar} size="sm" isGroup={isGroup} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{displayName}</div>
          <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
            <span className="text-schappo-600 font-medium">{conversa.categoria.toUpperCase()}</span> &middot; {conversa.provider}
            {conversa.telefone && ` \u00B7 ${conversa.telefone}`}
            {isGroup && syncedMemberCount && ` \u00B7 ${syncedMemberCount} membros`}
          </div>
        </div>

        {/* Desktop: acoes inline */}
        {!isMobile && (
          <>
            {conversa.provider === 'uazapi' && (
              <button onClick={handleSync} disabled={syncing} className="p-2 text-gray-400 hover:text-schappo-600 transition-colors disabled:opacity-50" title="Atualizar dados do WhatsApp">
                <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <button onClick={() => { setSearchOpen(!searchOpen); setSearchTerm(''); setSearchIndex(0); }} className={`p-2 transition-colors ${searchOpen ? 'text-schappo-600' : 'text-gray-400 hover:text-schappo-600'}`} title="Buscar mensagens">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <AtribuirDropdown conversaId={conversa.id} atendenteId={conversa.atendente_id} atendenteNome={(conversa as Conversa & { atendente_nome?: string }).atendente_nome} onAtribuir={onAtribuir} />
            {currentUserId && conversa.atendente_id === currentUserId && onFinalizar && (
              <button onClick={() => onFinalizar(conversa.id)} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors" title="Finalizar atendimento e liberar conversa">
                Finalizar
              </button>
            )}
            {currentUserRole === 'admin' && onDeleteConversa && (
              <button onClick={() => { if (window.confirm(`Excluir conversa "${displayName}" e todas as mensagens? Esta acao nao pode ser desfeita.`)) onDeleteConversa(conversa.id); }} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Excluir conversa">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            {!isGroup && conversa.telefone && onDialNumber && (
              <button onClick={() => onDialNumber(conversa.telefone!)} className="p-2 text-gray-400 hover:text-schappo-600 transition-colors" title="Discar no softphone">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            )}
            {!isGroup && conversa.telefone && !onDialNumber && (
              <CallButton telefone={conversa.telefone} size="md" label="Ligar" />
            )}
          </>
        )}

        {/* Mobile: busca + menu colapsado */}
        {isMobile && (
          <>
            <button onClick={() => { setSearchOpen(!searchOpen); setSearchTerm(''); setSearchIndex(0); }} className={`p-2 transition-colors ${searchOpen ? 'text-schappo-600' : 'text-gray-400 hover:text-schappo-600'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <div className="relative" ref={moreMenuRef}>
              <button onClick={() => setMoreMenuOpen((p) => !p)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {moreMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 py-1 min-w-[180px] z-50">
                  <AtribuirDropdown conversaId={conversa.id} atendenteId={conversa.atendente_id} atendenteNome={(conversa as Conversa & { atendente_nome?: string }).atendente_nome} onAtribuir={(id, aid) => { onAtribuir(id, aid); setMoreMenuOpen(false); }} />
                  {conversa.provider === 'uazapi' && (
                    <button onClick={() => { handleSync(); setMoreMenuOpen(false); }} disabled={syncing} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                      Atualizar WhatsApp
                    </button>
                  )}
                  {currentUserId && conversa.atendente_id === currentUserId && onFinalizar && (
                    <button onClick={() => { onFinalizar(conversa.id); setMoreMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                      Finalizar
                    </button>
                  )}
                  {!isGroup && conversa.telefone && onDialNumber && (
                    <button onClick={() => { onDialNumber(conversa.telefone!); setMoreMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                      Ligar
                    </button>
                  )}
                  {currentUserRole === 'admin' && onDeleteConversa && (
                    <button onClick={() => { if (window.confirm(`Excluir conversa "${displayName}"?`)) onDeleteConversa(conversa.id); setMoreMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                      Excluir conversa
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Barra de busca */}
      {searchOpen && (
        <div className="h-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-3 gap-2 shrink-0">
          <input
            autoFocus
            type="text"
            placeholder="Buscar mensagens..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setSearchIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setSearchOpen(false); setSearchTerm(''); }
              if (e.key === 'Enter') setSearchIndex((i) => (i + 1) % (searchMatches.length || 1));
            }}
            className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:border-schappo-500"
          />
          {searchTerm.length >= 2 && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {searchMatches.length > 0 ? `${searchIndex + 1}/${searchMatches.length}` : '0 resultados'}
            </span>
          )}
          <button onClick={() => setSearchIndex((i) => Math.max(0, i - 1))} className="p-1 text-gray-400 hover:text-gray-600" title="Anterior">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button onClick={() => setSearchIndex((i) => Math.min(searchMatches.length - 1, i + 1))} className="p-1 text-gray-400 hover:text-gray-600" title="Proximo">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button onClick={() => { setSearchOpen(false); setSearchTerm(''); }} className="p-1 text-gray-400 hover:text-red-500" title="Fechar">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Banner do paciente (ERP lookup) */}
      <PacienteBanner telefone={conversa.telefone} tipo={conversa.tipo} />

      {/* Aviso janela 24h expirada (360Dialog) */}
      {is360WindowExpired && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-xs text-amber-800 dark:text-amber-300 flex-1 min-w-0">
            Janela de 24h expirada — mensagens de texto livre nao serao entregues. Use um template aprovado.
          </span>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="shrink-0 px-3 py-1 text-xs font-medium text-white bg-schappo-600 hover:bg-schappo-700 rounded-lg transition-colors"
          >
            Enviar template
          </button>
        </div>
      )}

      {/* Area de mensagens */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 px-4 py-3">
        {hasMore && (
          <div className="text-center mb-3">
            <button
              onClick={onLoadMore}
              className="text-xs text-schappo-600 hover:underline"
            >
              Carregar mensagens anteriores
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Carregando mensagens...
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Nenhuma mensagem
          </div>
        ) : (
          mensagens.map((msg, idx) => {
            // Separador de data: exibir quando a data muda entre mensagens
            const prevMsg = idx > 0 ? mensagens[idx - 1] : null;
            const showSeparator = shouldShowDateSeparator(msg, prevMsg);
            let dateSeparator: React.ReactNode = null;

            if (showSeparator) {
              const dateLabel = getDateLabel(new Date(msg.created_at));

              dateSeparator = (
                <div key={`date-${msg.id}`} className="flex items-center justify-center my-3">
                  <div className="px-3 py-1 bg-white dark:bg-gray-700 rounded-lg shadow-sm text-xs font-medium text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                    {dateLabel}
                  </div>
                </div>
              );
            }

            return (
              <React.Fragment key={msg.id}>
                {dateSeparator}
                <div
                  ref={(el) => { if (el) msgRefs.current.set(msg.id, el); else msgRefs.current.delete(msg.id); }}
                  className={`flex items-start gap-1 min-w-0 ${selectMode ? 'cursor-pointer' : ''}`}
                  onClick={selectMode ? (e) => { e.stopPropagation(); handleToggleSelect(msg.id); } : undefined}
                >
                  {selectMode && (
                    <div className="shrink-0 flex items-center pt-2 pl-1">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedMsgIds.has(msg.id)
                          ? 'bg-schappo-600 border-schappo-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {selectedMsgIds.has(msg.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <MessageBubble
                      mensagem={msg}
                      showSender={isGroup}
                      isAdmin={currentUserRole === 'admin'}
                      onDelete={onDeleteMensagem ? (msgId) => onDeleteMensagem(conversa.id, msgId) : undefined}
                      onResend={doResend}
                      onContextMenu={selectMode ? undefined : handleContextMenu}
                    />
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          mensagem={contextMenu.mensagem}
          isAdmin={currentUserRole === 'admin'}
          isOwnMessage={contextMenu.mensagem.from_me}
          onCopy={handleCopy}
          onReply={handleReply}
          onForward={handleForward}
          onReact={handleReact}
          onResend={handleResend}
          onEdit={onEditMensagem ? handleEdit : undefined}
          onDelete={handleDelete}
          onSelect={() => {
            setSelectMode(true);
            setSelectedMsgIds(new Set([contextMenu.mensagem.id]));
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Reaction Picker */}
      {reactionTarget && (
        <ReactionPicker
          position={{ x: reactionTarget.x, y: reactionTarget.y }}
          onReact={handleSendReaction}
          onClose={() => setReactionTarget(null)}
        />
      )}

      {/* Barra flutuante de selecao */}
      {selectMode && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white dark:bg-gray-900 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-2">
          <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            {selectedMsgIds.size} selecionada{selectedMsgIds.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleForwardSelected}
            disabled={selectedMsgIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-schappo-600 rounded-full hover:bg-schappo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Encaminhar
          </button>
          <button
            onClick={exitSelectMode}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="Cancelar selecao"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Forward Modal */}
      {forwardingMsgs.length > 0 && (
        <ForwardModal
          mensagens={forwardingMsgs}
          onClose={() => { setForwardingMsgs([]); exitSelectMode(); }}
        />
      )}

      {/* Campo de envio de mensagem ou barra de bloqueio */}
      {currentUserId && conversa.atendente_id !== null && conversa.atendente_id !== currentUserId ? (
        <div className="px-4 py-3 bg-gray-100 dark:bg-black border-t border-gray-200 dark:border-gray-800 text-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Atendimento em andamento por <span className="font-semibold text-gray-700 dark:text-gray-300">{(conversa as Conversa & { atendente_nome?: string }).atendente_nome || 'outro operador'}</span>
          </span>
        </div>
      ) : (
        <MessageInput
          onSend={handleSend}
          conversaId={conversa.id}
          chatId={conversa.wa_chatid}
          tipoConversa={conversa.tipo}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingMsg={editingMsg}
          onCancelEdit={() => setEditingMsg(null)}
          onEdit={handleEditSend}
        />
      )}

      {/* Template Send Modal (360Dialog) */}
      {showTemplateModal && conversa && (
        <TemplateSendModal
          conversaId={conversa.id}
          nomeContato={conversa.nome_contato}
          onClose={() => setShowTemplateModal(false)}
          onSent={() => {
            // Scroll para o final apos enviar template
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
          }}
        />
      )}
    </div>
  );
}
