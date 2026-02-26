'use client';

import { Mensagem } from '@/lib/types';

interface QuotedMessageProps {
  mensagem: Mensagem;
  onCancel?: () => void;
  /** Quando true, renderiza inline dentro de um balao (sem botao cancelar, compacto) */
  inline?: boolean;
}

function getPreviewText(msg: Mensagem): string {
  const tipoMap: Record<string, string> = {
    image: '[Imagem]',
    audio: '[Audio]',
    video: '[Video]',
    document: '[Documento]',
    sticker: '[Sticker]',
    location: '[Localizacao]',
    contact: '[Contato]',
  };

  const tipo = msg.tipo_mensagem.toLowerCase().replace('message', '');
  if (tipoMap[tipo]) {
    const caption = msg.conteudo?.trim();
    return caption ? `${tipoMap[tipo]} ${caption}` : tipoMap[tipo];
  }

  return msg.conteudo?.slice(0, 120) || '';
}

export default function QuotedMessage({ mensagem, onCancel, inline }: QuotedMessageProps) {
  const senderName = mensagem.from_me ? 'Você' : (mensagem.sender_name || mensagem.sender_phone || '');
  const preview = getPreviewText(mensagem);

  if (inline) {
    return (
      <div className="border-l-3 border-schappo-400 bg-gray-100 dark:bg-gray-800/60 rounded-r px-2 py-1 mb-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors">
        <div className="text-xs font-semibold text-schappo-600 dark:text-schappo-400 truncate">{senderName}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{preview}</div>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-2 flex items-start gap-2 bg-gray-50 rounded-lg border-l-4 border-schappo-500 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-schappo-600 truncate">{senderName}</div>
        <div className="text-xs text-gray-500 truncate">{preview}</div>
      </div>
      {onCancel && (
        <button
          onClick={onCancel}
          className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
          title="Cancelar resposta"
          type="button"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
