'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';

interface MessageInputProps {
  onSend: (conteudo: string) => Promise<void>;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

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
  }, [text, sending, onSend]);

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

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-2 shrink-0">
      {error && (
        <div className="mb-2 px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-md flex items-center gap-2">
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
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
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
          disabled={disabled || sending || !text.trim()}
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
      <div className="text-[10px] text-gray-300 mt-1 text-right">
        Enter para enviar &middot; Shift+Enter para quebra de linha
      </div>
    </div>
  );
}
