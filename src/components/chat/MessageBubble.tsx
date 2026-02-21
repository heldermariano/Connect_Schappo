'use client';

import { ReactNode } from 'react';
import { Mensagem } from '@/lib/types';
import MediaPreview from './MediaPreview';
import { getSenderColor } from '@/components/ui/Avatar';

interface MessageBubbleProps {
  mensagem: Mensagem;
  showSender: boolean; // Em grupos, mostra nome do remetente
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
 * Renderiza texto com mencoes destacadas em negrito laranja.
 * Detecta padroes @NUMERO e @NOME no texto.
 */
function renderTextWithMentions(text: string, mencoes: string[]): ReactNode[] {
  if (!mencoes || mencoes.length === 0) {
    return [text];
  }

  // Regex para encontrar mencoes: @seguido de numero ou nome (ate espaco/pontuacao)
  const mentionRegex = /@([\d+]+|[\w\u00C0-\u017F]+(?:\s[\w\u00C0-\u017F]+)?)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Texto antes da mencao
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const mentionText = match[0];
    const mentionValue = match[1];

    // Verificar se este valor corresponde a uma mencao real
    const isMention = mencoes.some((phone) => {
      return mentionValue === phone || phone.endsWith(mentionValue) || mentionValue.includes(phone.slice(-4));
    });

    if (isMention) {
      parts.push(
        <span key={match.index} className="text-schappo-500 font-semibold">
          {mentionText}
        </span>,
      );
    } else {
      // @ encontrado mas nao bate com mencoes reais — destacar mesmo assim
      // pois o WhatsApp envia o texto com @ para mencoes
      parts.push(
        <span key={match.index} className="text-schappo-500 font-semibold">
          {mentionText}
        </span>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Texto restante
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function MessageBubble({ mensagem, showSender }: MessageBubbleProps) {
  const isMe = mensagem.from_me;
  const hasMedia = ['image', 'audio', 'video', 'document', 'sticker'].includes(mensagem.tipo_mensagem);

  // Nome a exibir: sender_name ou telefone formatado
  const senderDisplay = mensagem.sender_name || formatPhoneShort(mensagem.sender_phone);
  const senderColor = senderDisplay ? getSenderColor(senderDisplay) : 'text-schappo-600';

  const mencoes = mensagem.mencoes || [];

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 ${
          isMe ? 'bg-green-100 text-gray-900' : 'bg-white text-gray-900 shadow-sm'
        }`}
      >
        {/* Nome do remetente em grupos (com cor unica por pessoa) */}
        {showSender && !isMe && senderDisplay && (
          <div className={`text-xs font-semibold mb-0.5 ${senderColor}`}>
            {senderDisplay}
          </div>
        )}

        {/* Preview de midia */}
        {hasMedia && (
          <MediaPreview
            tipo={mensagem.tipo_mensagem}
            url={mensagem.media_url}
            mimetype={mensagem.media_mimetype}
            filename={mensagem.media_filename}
          />
        )}

        {/* Conteudo de texto com mencoes destacadas */}
        {mensagem.conteudo && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {mencoes.length > 0
              ? renderTextWithMentions(mensagem.conteudo, mencoes)
              : mensagem.conteudo}
          </p>
        )}

        {/* Hora + status */}
        <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-gray-400">{formatTime(mensagem.created_at)}</span>
          {isMe && <StatusIcon status={mensagem.status} />}
        </div>
      </div>
    </div>
  );
}
