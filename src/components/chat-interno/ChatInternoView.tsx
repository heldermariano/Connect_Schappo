'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ChatInterno, ChatInternoMensagem } from '@/lib/types';
import ChatInternoMessage from './ChatInternoMessage';
import StatusBadge, { StatusPresenca } from '@/components/ui/StatusBadge';

const EmojiPickerButton = dynamic(() => import('@/components/chat/EmojiPickerButton'), { ssr: false });
const AudioRecorder = dynamic(() => import('@/components/chat/AudioRecorder'), { ssr: false });

interface ChatInternoViewProps {
  chat: ChatInterno | null;
  mensagens: ChatInternoMensagem[];
  loading: boolean;
  currentUserId: number;
  onSend: (chatId: number, conteudo: string, replyToId?: number) => void;
  onSendMedia?: (chatId: number, file: File, caption?: string, voiceRecording?: boolean, replyToId?: number) => void;
  onReact?: (chatId: number, mensagemId: number, emoji: string) => void;
}

export default function ChatInternoView({ chat, mensagens, loading, currentUserId, onSend, onSendMedia, onReact }: ChatInternoViewProps) {
  const [texto, setTexto] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatInternoMensagem | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mensagens.length > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCountRef.current = mensagens.length;
  }, [mensagens.length]);

  // Focar input ao definir reply
  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-black">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">Selecione um operador para iniciar uma conversa</p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    onSend(chat.id, texto.trim(), replyingTo?.id);
    setTexto('');
    setReplyingTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape' && replyingTo) {
      setReplyingTo(null);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setTexto((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSendMedia) {
      onSendMedia(chat.id, file, undefined, false, replyingTo?.id);
      setReplyingTo(null);
    }
    // Reset input
    e.target.value = '';
  };

  const handleRecordingComplete = (file: File) => {
    if (onSendMedia) {
      onSendMedia(chat.id, file, undefined, true, replyingTo?.id);
      setReplyingTo(null);
    }
    setIsRecording(false);
  };

  const handleReply = (msg: ChatInternoMensagem) => {
    setReplyingTo(msg);
  };

  const handleReact = (mensagemId: number, emoji: string) => {
    if (onReact) onReact(chat.id, mensagemId, emoji);
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-black min-h-0 overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3 bg-white dark:bg-black shrink-0 z-10">
        <div className="w-8 h-8 rounded-full bg-schappo-100 flex items-center justify-center text-xs font-bold text-schappo-700">
          {chat.outro_nome?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{chat.outro_nome}</div>
        </div>
        <StatusBadge status={(chat.outro_status || 'offline') as StatusPresenca} />
      </div>

      {/* Mensagens — area com scroll, min-h-0 garante que o flex-1 encolha */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Carregando...</div>
        ) : mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Nenhuma mensagem ainda</div>
        ) : (
          <>
            {mensagens.map((msg) => (
              <ChatInternoMessage
                key={msg.id}
                mensagem={msg}
                isOwn={msg.atendente_id === currentUserId}
                onReact={handleReact}
                onReply={handleReply}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Audio recorder — fixo na base */}
      {isRecording && (
        <AudioRecorder
          onRecordingComplete={handleRecordingComplete}
          onCancel={() => setIsRecording(false)}
        />
      )}

      {/* Reply preview — fixo acima do input */}
      {replyingTo && !isRecording && (
        <div className="px-3 pt-2 flex items-center gap-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
          <div className="flex-1 min-w-0 border-l-2 border-schappo-500 pl-2 py-0.5">
            <div className="text-[10px] font-semibold text-schappo-600">{replyingTo.nome_remetente || 'Voce'}</div>
            <div className="text-[11px] text-gray-500 truncate">{replyingTo.conteudo || 'Midia'}</div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input — fixo na base, nunca encolhe */}
      {!isRecording && (
        <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-800 p-2 flex items-center gap-1.5 shrink-0 bg-white dark:bg-black">
          {/* Emoji picker */}
          <EmojiPickerButton onEmojiSelect={handleEmojiSelect} />

          {/* Attach */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-schappo-600 hover:bg-gray-100 transition-colors"
            title="Anexar arquivo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
          />

          {/* Send or mic */}
          {texto.trim() ? (
            <button
              type="submit"
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-schappo-500 text-white hover:bg-schappo-600 transition-colors"
              title="Enviar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsRecording(true)}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-100 transition-colors"
              title="Gravar audio"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
        </form>
      )}
    </div>
  );
}
