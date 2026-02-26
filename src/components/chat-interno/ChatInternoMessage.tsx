'use client';

import { useState } from 'react';
import { ChatInternoMensagem } from '@/lib/types';

interface ChatInternoMessageProps {
  mensagem: ChatInternoMensagem;
  isOwn: boolean;
  onReact?: (mensagemId: number, emoji: string) => void;
  onReply?: (mensagem: ChatInternoMensagem) => void;
}

const QUICK_EMOJIS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDE4F'];

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function renderMedia(mensagem: ChatInternoMensagem) {
  const tipo = mensagem.tipo || 'text';
  const url = mensagem.media_url;
  if (!url || tipo === 'text') return null;

  if (tipo === 'image') {
    return (
      <img
        src={url}
        alt={mensagem.media_filename || 'Imagem'}
        className="max-w-full rounded-md mb-1 cursor-pointer"
        style={{ maxHeight: 200 }}
        onClick={() => window.open(url, '_blank')}
      />
    );
  }

  if (tipo === 'audio' || tipo === 'ptt') {
    return (
      <audio controls className="w-full mb-1" style={{ maxWidth: 220 }}>
        <source src={url} type={mensagem.media_mimetype || 'audio/webm'} />
      </audio>
    );
  }

  if (tipo === 'video') {
    return (
      <video controls className="max-w-full rounded-md mb-1" style={{ maxHeight: 200 }}>
        <source src={url} type={mensagem.media_mimetype || 'video/mp4'} />
      </video>
    );
  }

  // Document
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2 py-1.5 bg-white/10 rounded mb-1 hover:bg-white/20 transition-colors"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <span className="text-xs truncate">{mensagem.media_filename || 'Documento'}</span>
    </a>
  );
}

export default function ChatInternoMessage({ mensagem, isOwn, onReact, onReply }: ChatInternoMessageProps) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const reacoes = mensagem.reacoes || [];

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2 group relative`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      <div className="relative max-w-[75%]">
        {/* Action buttons (hover) */}
        {showActions && (
          <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} flex items-center gap-0.5 z-10`}>
            <button
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-500 transition-colors"
              title="Reagir"
              type="button"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {onReply && (
              <button
                onClick={() => onReply(mensagem)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-500 transition-colors"
                title="Responder"
                type="button"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Quick emoji picker */}
        {showEmojiPicker && onReact && (
          <div className={`absolute bottom-full ${isOwn ? 'right-0' : 'left-0'} mb-1 z-20`}>
            <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-1.5 py-0.5">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onReact(mensagem.id, emoji); setShowEmojiPicker(false); }}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-base transition-colors"
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`px-3 py-2 rounded-lg text-sm ${
            isOwn
              ? 'bg-schappo-500 text-white rounded-br-none'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none'
          }`}
        >
          {!isOwn && mensagem.nome_remetente && (
            <div className="text-xs font-semibold text-schappo-600 mb-0.5">{mensagem.nome_remetente}</div>
          )}

          {/* Quoted reply */}
          {mensagem.reply_to && (
            <div className={`border-l-2 ${isOwn ? 'border-white/50' : 'border-schappo-400'} pl-2 mb-1.5 py-0.5`}>
              <div className={`text-[10px] font-semibold ${isOwn ? 'text-white/80' : 'text-schappo-600'}`}>
                {mensagem.reply_to.nome_remetente}
              </div>
              <div className={`text-[11px] ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'} truncate`}>
                {mensagem.reply_to.conteudo || 'Midia'}
              </div>
            </div>
          )}

          {/* Media */}
          {renderMedia(mensagem)}

          {/* Text content */}
          {mensagem.conteudo && (
            <p className="whitespace-pre-wrap break-words">{mensagem.conteudo}</p>
          )}

          <div className={`text-[10px] mt-0.5 text-right ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
            {formatTime(mensagem.created_at)}
          </div>
        </div>

        {/* Reactions below bubble */}
        {reacoes.length > 0 && (
          <div className={`flex flex-wrap gap-0.5 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {reacoes.map((r, i) => (
              <span
                key={`${r.atendente_id}-${i}`}
                className="inline-flex items-center gap-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-1.5 py-0.5 text-xs shadow-sm cursor-default"
                title={r.nome}
              >
                {r.emoji}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
