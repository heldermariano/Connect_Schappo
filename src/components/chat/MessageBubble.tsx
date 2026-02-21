'use client';

import { Mensagem } from '@/lib/types';
import MediaPreview from './MediaPreview';

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

export default function MessageBubble({ mensagem, showSender }: MessageBubbleProps) {
  const isMe = mensagem.from_me;
  const hasMedia = ['image', 'audio', 'video', 'document', 'sticker'].includes(mensagem.tipo_mensagem);

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 ${
          isMe ? 'bg-green-100 text-gray-900' : 'bg-white text-gray-900 shadow-sm'
        }`}
      >
        {/* Nome do remetente em grupos */}
        {showSender && !isMe && mensagem.sender_name && (
          <div className="text-xs font-semibold text-schappo-600 mb-0.5">
            {mensagem.sender_name}
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

        {/* Conteudo de texto */}
        {mensagem.conteudo && (
          <p className="text-sm whitespace-pre-wrap break-words">{mensagem.conteudo}</p>
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
