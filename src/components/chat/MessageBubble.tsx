'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { Mensagem } from '@/lib/types';
import MediaPreview from './MediaPreview';
import QuotedMessage from './QuotedMessage';
import Avatar, { getSenderColor } from '@/components/ui/Avatar';

interface MessageBubbleProps {
  mensagem: Mensagem;
  showSender: boolean; // Em grupos, mostra nome do remetente
  isAdmin?: boolean;
  onDelete?: (msgId: number) => void;
  onResend?: (msgId: number) => void;
  onContextMenu?: (data: { x: number; y: number; mensagem: Mensagem }) => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABELS: Record<string, string> = {
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falha no envio',
};

function StatusIcon({ status, metadata }: { status: string; metadata?: Record<string, unknown> }) {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fechar popover ao clicar fora
  useEffect(() => {
    if (!showPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPopover]);

  // Check unico (enviada)
  const singleCheck = (
    <svg className="w-4 h-3.5" viewBox="0 0 16 11" fill="none">
      <path d="M11.071 0.929L5 7l-2.071-2.071L1.515 6.343 5 9.828l7.485-7.485L11.071 0.929z" fill="currentColor"/>
    </svg>
  );
  // Check duplo (entregue/lida)
  const doubleCheck = (
    <svg className="w-5 h-3.5" viewBox="0 0 20 11" fill="none">
      <path d="M15.071 0.929L9 7l-0.071-0.071L7.515 8.343 9 9.828l7.485-7.485L15.071 0.929z" fill="currentColor"/>
      <path d="M11.071 0.929L5 7l-2.071-2.071L1.515 6.343 5 9.828l7.485-7.485L11.071 0.929z" fill="currentColor"/>
    </svg>
  );

  let icon: ReactNode = null;
  let colorClass = '';
  switch (status) {
    case 'sent':
      icon = singleCheck;
      colorClass = 'text-gray-400';
      break;
    case 'delivered':
      icon = doubleCheck;
      colorClass = 'text-gray-400';
      break;
    case 'read':
      icon = doubleCheck;
      colorClass = 'text-blue-500';
      break;
    case 'failed':
      icon = (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 4v5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
      colorClass = 'text-red-500';
      break;
    default:
      return null;
  }

  // Construir historico de status
  const statusHistory = (metadata?.status_history as Array<{ status: string; timestamp: string }>) || [];
  const resentAt = metadata?.resent_at as string | undefined;
  const resentBy = metadata?.resent_by as string | undefined;
  const hasDetails = statusHistory.length > 0 || resentAt;

  return (
    <span className={`${colorClass} inline-flex relative`}>
      <button
        onClick={(e) => { e.stopPropagation(); if (hasDetails) setShowPopover(!showPopover); }}
        className={`inline-flex ${hasDetails ? 'cursor-pointer hover:opacity-70' : 'cursor-default'}`}
        title={STATUS_LABELS[status] || status}
      >
        {icon}
      </button>
      {showPopover && hasDetails && (
        <div
          ref={popoverRef}
          className="absolute bottom-full right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 min-w-[160px] z-50 text-left"
        >
          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Status da mensagem</div>
          {statusHistory.map((entry, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="text-[10px] text-gray-400 w-10">{formatTime(entry.timestamp)}</span>
              <span className={`text-[10px] font-medium ${entry.status === 'read' ? 'text-blue-500' : entry.status === 'failed' ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                {STATUS_LABELS[entry.status] || entry.status}
              </span>
            </div>
          ))}
          {resentAt && (
            <div className="flex items-center gap-2 py-0.5 border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
              <span className="text-[10px] text-gray-400 w-10">{formatTime(resentAt)}</span>
              <span className="text-[10px] font-medium text-amber-600">Reenviada{resentBy ? ` por ${resentBy}` : ''}</span>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

/**
 * Formata um telefone para exibicao curta.
 */
function formatPhoneShort(phone: string | null): string {
  if (!phone) return '';
  const num = phone.replace(/\D/g, '');
  if (num.length >= 12 && num.startsWith('55')) {
    return `(${num.slice(2, 4)}) ${num.slice(4)}`;
  }
  return phone;
}

/**
 * Limpa conteudo que pode ter sido salvo como JSON bruto.
 * Extrai o campo .text de objetos JSON, ou retorna null se for pura midia.
 */
function cleanContent(conteudo: string | null, tipo: string): string | null {
  if (!conteudo) return null;

  // Se nao comeca com {, eh texto normal
  if (!conteudo.startsWith('{')) return conteudo;

  try {
    const parsed = JSON.parse(conteudo);
    // Se tem campo .text, extrair
    if (parsed.text && typeof parsed.text === 'string') {
      return parsed.text;
    }
    // Se eh midia (tem URL), nao exibir como texto
    if (parsed.URL) return null;
    // Se eh reacao (tem key), extrair texto
    if (parsed.key && parsed.text !== undefined) {
      return String(parsed.text);
    }
  } catch {
    // Nao eh JSON valido, retornar como esta
  }
  return conteudo;
}

/**
 * Renderiza texto com mencoes destacadas em negrito laranja.
 * Substitui @NUMERO por @NOME quando disponivel no mapa de mencoes resolvidas.
 * Funciona tanto para mencoes do array quanto para @numero encontrados no texto.
 */
function renderTextWithMentions(text: string, mencoesResolvidas?: Record<string, string>): ReactNode[] {
  if (!mencoesResolvidas || Object.keys(mencoesResolvidas).length === 0) {
    // Sem resolucao disponivel — ainda destacar @mencoes visualmente
    const mentionRegex = /@([\d+]+|[\w\u00C0-\u017F]+(?:\s[\w\u00C0-\u017F]+)?)/g;
    if (!mentionRegex.test(text)) return [text];
    mentionRegex.lastIndex = 0;

    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      parts.push(
        <span key={match.index} className="text-schappo-500 font-semibold">{match[0]}</span>,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  }

  // Regex para encontrar mencoes: @seguido de numero ou nome (ate espaco/pontuacao)
  const mentionRegex = /@([\d+]+|[\w\u00C0-\u017F]+(?:\s[\w\u00C0-\u017F]+)?)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const mentionValue = match[1];

    // Tentar resolver nome da mencao
    let displayName = match[0];
    // Procurar pelo numero exato, parcial (sufixo) ou contido
    for (const [phone, nome] of Object.entries(mencoesResolvidas)) {
      const cleanPhone = phone.replace(/\D/g, '');
      const cleanMention = mentionValue.replace(/\D/g, '');
      if (
        cleanMention === cleanPhone ||
        cleanPhone.endsWith(cleanMention) ||
        cleanMention.endsWith(cleanPhone) ||
        cleanPhone.includes(cleanMention) ||
        cleanMention.includes(cleanPhone)
      ) {
        displayName = `@${nome}`;
        break;
      }
    }

    parts.push(
      <span key={match.index} className="text-schappo-500 font-semibold">
        {displayName}
      </span>,
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function MessageBubble({ mensagem, showSender, isAdmin, onDelete, onResend, onContextMenu }: MessageBubbleProps) {
  const isMe = mensagem.from_me;
  const tipoNorm = mensagem.tipo_mensagem.toLowerCase().replace('message', '');
  const hasMedia = ['image', 'audio', 'video', 'document', 'sticker'].includes(mensagem.tipo_mensagem)
    || ['image', 'audio', 'video', 'document', 'sticker'].includes(tipoNorm);
  const isReaction = mensagem.tipo_mensagem === 'reaction' || tipoNorm === 'reaction';

  // Limpar conteudo que pode ser JSON bruto (dados antigos)
  const textoLimpo = cleanContent(mensagem.conteudo, mensagem.tipo_mensagem);

  // Usar messageId para proxy de midia (em vez de URL direta do WhatsApp)
  const hasWaMessageId = !!mensagem.wa_message_id;

  // Nome a exibir: sender_name ou telefone formatado
  const senderDisplay = mensagem.sender_name || formatPhoneShort(mensagem.sender_phone);
  const senderColor = senderDisplay ? getSenderColor(senderDisplay) : 'text-schappo-600';

  const mencoesResolvidas = mensagem.mencoes_resolvidas;

  // Reacoes: nao sao balaos, exibidas como badge nas mensagens alvo
  if (isReaction) return null;

  // Agregar emojis unicos de reacoes
  const reactions = mensagem.reactions || [];
  const hasReactions = reactions.length > 0;
  const uniqueEmojis = hasReactions ? [...new Set(reactions.map(r => r.emoji))] : [];

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.({ x: e.clientX, y: e.clientY, mensagem });
  };

  return (
    <div
      className={`group flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}
      onContextMenu={handleContextMenu}
    >
      {/* Mini-avatar para mensagens recebidas em grupos */}
      {showSender && !isMe && (
        <div className="shrink-0 mr-1.5 mt-auto mb-1">
          <Avatar
            nome={senderDisplay || '?'}
            avatarUrl={mensagem.sender_avatar_url}
            size="xs"
          />
        </div>
      )}
      <div className={`relative max-w-[70%] min-w-[80px] ${hasReactions ? 'mb-3' : ''}`}>
      <div
        className={`rounded-lg px-3 py-2 ${
          isMe && mensagem.status === 'failed'
            ? 'bg-red-50 dark:bg-red-950/30 text-gray-900 dark:text-gray-100 ring-1 ring-red-300 dark:ring-red-800'
            : isMe ? 'bg-green-100 dark:bg-green-900/40 text-gray-900 dark:text-gray-100' : 'bg-white dark:bg-black text-gray-900 dark:text-gray-100 shadow-sm'
        }`}
      >
        {/* Nome do remetente em grupos (com cor unica por pessoa) */}
        {showSender && !isMe && senderDisplay && (
          <div className={`text-xs font-semibold mb-0.5 ${senderColor}`}>
            {senderDisplay}
          </div>
        )}

        {/* Nome do operador em mensagens enviadas */}
        {isMe && senderDisplay && (
          <div className="text-xs font-semibold mb-0.5 text-green-700">
            {senderDisplay}
          </div>
        )}

        {/* Preview da mensagem citada (reply) */}
        {mensagem.quoted_message && (
          <QuotedMessage mensagem={mensagem.quoted_message as unknown as import('@/lib/types').Mensagem} inline />
        )}

        {/* Preview de midia via proxy */}
        {hasMedia && (
          <MediaPreview
            tipo={mensagem.tipo_mensagem.includes('Message') ? tipoNorm : mensagem.tipo_mensagem}
            messageId={hasWaMessageId ? mensagem.id : null}
            mimetype={mensagem.media_mimetype}
            filename={mensagem.media_filename}
          />
        )}

        {/* Conteudo de texto com mencoes destacadas */}
        {textoLimpo && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {textoLimpo.includes('@')
              ? renderTextWithMentions(textoLimpo, mencoesResolvidas)
              : textoLimpo}
          </p>
        )}

        {/* Hora + status */}
        <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
          {mensagem.is_forwarded && (
            <span className="text-[10px] text-gray-400 italic mr-1">Encaminhada</span>
          )}
          {mensagem.is_edited && (
            <span className="text-[10px] text-gray-400 italic mr-1">editada</span>
          )}
          <span className="text-[10px] text-gray-400">{formatTime(mensagem.created_at)}</span>
          {isMe && <StatusIcon status={mensagem.status} metadata={mensagem.metadata} />}
        </div>

        {/* Alerta de falha + botao reenviar */}
        {isMe && mensagem.status === 'failed' && onResend && (
          <button
            onClick={(e) => { e.stopPropagation(); onResend(mensagem.id); }}
            className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-[11px] font-medium w-full justify-center"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reenviar mensagem
          </button>
        )}
      </div>
      {/* Botao excluir mensagem (admin only, hover) */}
      {isAdmin && onDelete && (
        <button
          onClick={() => {
            if (window.confirm('Excluir esta mensagem?')) {
              onDelete(mensagem.id);
            }
          }}
          className={`absolute top-1 ${isMe ? 'left-[-24px]' : 'right-[-24px]'} hidden group-hover:block p-1 text-gray-400 hover:text-red-500 transition-colors`}
          title="Excluir mensagem"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
      {/* Badge de reacoes — posicionado sobre o canto inferior do balao */}
      {hasReactions && (
        <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} flex gap-0.5 bg-white dark:bg-gray-800 rounded-full px-1.5 py-0.5 shadow-sm border border-gray-200 dark:border-gray-700 text-xs`}>
          {uniqueEmojis.map(emoji => (
            <span key={emoji}>{emoji}</span>
          ))}
          {reactions.length > 1 && <span className="text-gray-500 text-[10px] ml-0.5">{reactions.length}</span>}
        </div>
      )}
      </div>
    </div>
  );
}
