'use client';

import { ChatInternoMensagem } from '@/lib/types';

interface ChatInternoMessageProps {
  mensagem: ChatInternoMensagem;
  isOwn: boolean;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatInternoMessage({ mensagem, isOwn }: ChatInternoMessageProps) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
          isOwn
            ? 'bg-schappo-500 text-white rounded-br-none'
            : 'bg-gray-100 dark:bg-black text-gray-900 dark:text-gray-100 rounded-bl-none'
        }`}
      >
        {!isOwn && mensagem.nome_remetente && (
          <div className="text-xs font-semibold text-schappo-600 mb-0.5">{mensagem.nome_remetente}</div>
        )}
        <p className="whitespace-pre-wrap break-words">{mensagem.conteudo}</p>
        <div className={`text-[10px] mt-0.5 text-right ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
          {formatTime(mensagem.created_at)}
        </div>
      </div>
    </div>
  );
}
