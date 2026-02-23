'use client';

import { ReactNode } from 'react';
import { Mensagem } from '@/lib/types';
import MediaPreview from './MediaPreview';
import QuotedMessage from './QuotedMessage';
import Avatar, { getSenderColor } from '@/components/ui/Avatar';

interface MessageBubbleProps {
  mensagem: Mensagem;
  showSender: boolean; // Em grupos, mostra nome do remetente
  isAdmin?: boolean;
  onDelete?: (msgId: number) => void;
  onContextMenu?: (data: { x: number; y: number; mensagem: Mensagem }) => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <span className="text-gray-400" title="Enviada">&#10003;</span>;
    case 'delivered':
      return <span className="text-gray-400" title="Entregue">&#10003;&#10003;</span>;
    case 'read':
      return <span className="text-schappo-500" title="Lida">&#10003;&#10003;</span>;
    case 'failed':
      return <span className="text-red-500" title="Falha">!</span>;
    default:
      return null;
  }
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

export default function MessageBubble({ mensagem, showSender, isAdmin, onDelete, onContextMenu }: MessageBubbleProps) {
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

  // Reacoes: exibir inline compacto
  if (isReaction) return null;

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
      <div className="relative max-w-[70%] min-w-[80px]">
      <div
        className={`rounded-lg px-3 py-2 ${
          isMe ? 'bg-green-100 text-gray-900' : 'bg-white text-gray-900 shadow-sm'
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
          <span className="text-[10px] text-gray-400">{formatTime(mensagem.created_at)}</span>
          {isMe && <StatusIcon status={mensagem.status} />}
        </div>
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
      </div>
    </div>
  );
}
