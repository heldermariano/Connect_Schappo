'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Conversa, Mensagem } from '@/lib/types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import MessageContextMenu from './MessageContextMenu';
import ReactionPicker from './ReactionPicker';
import ForwardModal from './ForwardModal';
import AtribuirDropdown from './AtribuirDropdown';
import Avatar from '@/components/ui/Avatar';
import CallButton from '@/components/calls/CallButton';

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
  // Forward modal state
  const [forwardingMsg, setForwardingMsg] = useState<Mensagem | null>(null);
  // Edit state
  const [editingMsg, setEditingMsg] = useState<Mensagem | null>(null);

  // Sync state (UAZAPI /chat/details)
  const [syncedName, setSyncedName] = useState<string | null>(null);
  const [syncedAvatar, setSyncedAvatar] = useState<string | null>(null);
  const [syncedMemberCount, setSyncedMemberCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Limpar estados ao mudar de conversa
  useEffect(() => {
    setReplyingTo(null);
    setContextMenu(null);
    setReactionTarget(null);
    setForwardingMsg(null);
    setEditingMsg(null);
    setSyncedName(null);
    setSyncedAvatar(null);
    setSyncedMemberCount(null);
  }, [conversa?.id]);

  // Auto-scroll para ultima mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

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
    setForwardingMsg(contextMenu.mensagem);
    setContextMenu(null);
  }, [contextMenu]);

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

  if (!conversa) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-black text-gray-400 dark:text-gray-500">
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
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-black">
      {/* Header da conversa */}
      <div className="h-14 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3 shrink-0">
        <Avatar nome={displayName} avatarUrl={displayAvatar} size="sm" isGroup={isGroup} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{displayName}</div>
          <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
            <span className="text-schappo-600 font-medium">{conversa.categoria.toUpperCase()}</span> &middot; {conversa.provider}
            {conversa.telefone && ` \u00B7 ${conversa.telefone}`}
            {isGroup && syncedMemberCount && ` \u00B7 ${syncedMemberCount} membros`}
          </div>
        </div>
        {/* Botao sync contato/grupo via UAZAPI */}
        {conversa.provider === 'uazapi' && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2 text-gray-400 hover:text-schappo-600 transition-colors disabled:opacity-50"
            title="Atualizar dados do WhatsApp"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        <AtribuirDropdown
          conversaId={conversa.id}
          atendenteId={conversa.atendente_id}
          atendenteNome={(conversa as Conversa & { atendente_nome?: string }).atendente_nome}
          onAtribuir={onAtribuir}
        />
        {currentUserId && conversa.atendente_id === currentUserId && onFinalizar && (
          <button
            onClick={() => onFinalizar(conversa.id)}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            title="Finalizar atendimento e liberar conversa"
          >
            Finalizar
          </button>
        )}
        {/* Excluir conversa (admin only) */}
        {currentUserRole === 'admin' && onDeleteConversa && (
          <button
            onClick={() => {
              if (window.confirm(`Excluir conversa "${displayName}" e todas as mensagens? Esta acao nao pode ser desfeita.`)) {
                onDeleteConversa(conversa.id);
              }
            }}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="Excluir conversa"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
        {/* Click-to-call: apenas para conversas individuais com telefone */}
        {!isGroup && conversa.telefone && onDialNumber && (
          <button
            onClick={() => onDialNumber(conversa.telefone!)}
            className="p-2 text-gray-400 hover:text-schappo-600 transition-colors"
            title="Discar no softphone"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        )}
        {!isGroup && conversa.telefone && !onDialNumber && (
          <CallButton telefone={conversa.telefone} size="md" label="Ligar" />
        )}
      </div>

      {/* Area de mensagens */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3">
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
          mensagens.map((msg) => (
            <MessageBubble
              key={msg.id}
              mensagem={msg}
              showSender={isGroup}
              isAdmin={currentUserRole === 'admin'}
              onDelete={onDeleteMensagem ? (msgId) => onDeleteMensagem(conversa.id, msgId) : undefined}
              onContextMenu={handleContextMenu}
            />
          ))
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
          onEdit={onEditMensagem ? handleEdit : undefined}
          onDelete={handleDelete}
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

      {/* Forward Modal */}
      {forwardingMsg && (
        <ForwardModal
          mensagem={forwardingMsg}
          onClose={() => setForwardingMsg(null)}
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
    </div>
  );
}
