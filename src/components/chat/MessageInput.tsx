'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import AttachmentPreview from './AttachmentPreview';

interface MessageInputProps {
  onSend: (conteudo: string) => Promise<void>;
  conversaId?: number;
  disabled?: boolean;
}

const ACCEPTED_TYPES = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx';

export default function MessageInput({ onSend, conversaId, disabled }: MessageInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async () => {
    if (sending) return;

    // Enviar midia se tem arquivo anexado
    if (attachment && conversaId) {
      setSending(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('conversa_id', String(conversaId));
        formData.append('file', attachment);
        if (text.trim()) {
          formData.append('caption', text.trim());
        }

        const res = await fetch('/api/mensagens/send-media', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Erro ao enviar midia' }));
          throw new Error(data.error || 'Erro ao enviar midia');
        }

        setText('');
        setAttachment(null);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao enviar midia');
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
      return;
    }

    // Enviar texto
    const trimmed = text.trim();
    if (!trimmed) return;

    setSending(true);
    setError(null);

    try {
      await onSend(trimmed);
      setText('');
      // Resetar altura do textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
      // Focar no textarea apos envio
      textareaRef.current?.focus();
    }
  }, [text, sending, onSend, attachment, conversaId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Auto-resize do textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Limite de 16MB
      if (file.size > 16 * 1024 * 1024) {
        setError('Arquivo muito grande (max 16MB)');
        return;
      }
      setAttachment(file);
      setError(null);
    }
    // Resetar o input para permitir re-selecao do mesmo arquivo
    e.target.value = '';
  }, []);

  const canSend = attachment ? true : text.trim().length > 0;

  return (
    <div className="border-t border-gray-200 bg-white shrink-0">
      {error && (
        <div className="mx-4 mt-2 px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-md flex items-center gap-2">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Preview do arquivo anexado */}
      {attachment && (
        <div className="pt-2">
          <AttachmentPreview file={attachment} onRemove={() => setAttachment(null)} />
        </div>
      )}

      <div className="flex items-end gap-2 px-4 py-2">
        {/* Botao clipe - anexar arquivo */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                     text-gray-400 hover:text-schappo-600 hover:bg-gray-100
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          title="Anexar arquivo"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileSelect}
          className="hidden"
        />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={attachment ? 'Legenda (opcional)...' : 'Digite sua mensagem...'}
          disabled={disabled || sending}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent
                     disabled:bg-gray-100 disabled:text-gray-400
                     placeholder:text-gray-400"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || sending || !canSend}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                     bg-schappo-600 text-white hover:bg-schappo-700
                     disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors"
          title="Enviar mensagem"
        >
          {sending ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
      <div className="text-[10px] text-gray-300 px-4 pb-1 text-right">
        Enter para enviar &middot; Shift+Enter para quebra de linha
      </div>
    </div>
  );
}
