'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface ReactionPickerProps {
  position: { x: number; y: number };
  onReact: (emoji: string) => void;
  onClose: () => void;
}

const QUICK_EMOJIS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDE4F'];

export default function ReactionPicker({ position, onReact, onClose }: ReactionPickerProps) {
  const [showFull, setShowFull] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      onClose();
    }
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  // Reposicionar se necessario
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 320),
    top: Math.max(position.y - 50, 8),
    zIndex: 51,
  };

  return (
    <div ref={containerRef} style={style}>
      {!showFull ? (
        <div className="flex items-center gap-1 bg-white rounded-full shadow-lg border border-gray-200 px-2 py-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-lg transition-colors"
              type="button"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowFull(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
            title="Mais emojis"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="shadow-lg rounded-lg overflow-hidden">
          <EmojiPicker
            onEmojiClick={(emojiData) => onReact(emojiData.emoji)}
            width={320}
            height={400}
            searchPlaceHolder="Buscar emoji..."
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  );
}
