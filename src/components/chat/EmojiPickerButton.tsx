'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  /** Usar posicionamento fixo (necessario quando dentro de containers com overflow-hidden) */
  fixed?: boolean;
}

export default function EmojiPickerButton({ onEmojiSelect, disabled, size = 'md', fixed = false }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      // Calcular posicao fixa do picker quando em modo fixed
      if (fixed && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const pickerH = Math.min(350, window.innerHeight * 0.5);
        let top = rect.top - pickerH - 8;
        let left = rect.left;
        // Se sair pela esquerda, alinhar pela direita do botao
        if (left + 300 > window.innerWidth) {
          left = rect.right - 300;
        }
        // Se sair por cima, abrir abaixo
        if (top < 8) {
          top = rect.bottom + 8;
        }
        setPickerPos({ top, left });
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleClickOutside, handleKeyDown, fixed]);

  const pickerHeight = fixed ? Math.min(350, typeof window !== 'undefined' ? window.innerHeight * 0.5 : 350) : 400;
  const pickerWidth = fixed ? 300 : 320;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={`shrink-0 flex items-center justify-center rounded-full
                   text-gray-400 hover:text-schappo-600 hover:bg-gray-100
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors ${size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'}`}
        title="Emojis"
        type="button"
      >
        <svg className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div
          className={fixed ? 'fixed z-[60]' : 'absolute bottom-full right-0 mb-2 z-50'}
          style={fixed && pickerPos ? { top: pickerPos.top, left: pickerPos.left } : undefined}
        >
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              onEmojiSelect(emojiData.emoji);
              setOpen(false);
            }}
            width={pickerWidth}
            height={pickerHeight}
            searchPlaceHolder="Buscar emoji..."
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  );
}
