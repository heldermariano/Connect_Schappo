'use client';

import { useEffect, useRef, useState } from 'react';
import { RespostaPronta } from '@/lib/types';

interface QuickReplyAutocompleteProps {
  query: string;
  respostas: RespostaPronta[];
  onSelect: (resposta: RespostaPronta) => void;
  onClose: () => void;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function QuickReplyAutocomplete({
  query,
  respostas,
  onSelect,
  onClose,
}: QuickReplyAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = normalize(query);
  const filtered = respostas
    .filter((r) => {
      if (!normalizedQuery) return true;
      return (
        normalize(r.atalho).includes(normalizedQuery) ||
        normalize(r.conteudo).includes(normalizedQuery)
      );
    })
    .slice(0, 6);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(filtered.length, 1));
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 mx-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-3 z-50">
        <span className="text-sm text-gray-400">Nenhuma resposta encontrada</span>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 mx-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg overflow-y-auto z-50"
      style={{ maxHeight: '280px' }}
    >
      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Respostas prontas</span>
      </div>
      {filtered.map((r, i) => (
        <button
          key={r.id}
          type="button"
          className={`w-full flex flex-col gap-0.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
            ${i === selectedIndex ? 'bg-schappo-50 dark:bg-schappo-900/20' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(r);
          }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-schappo-600 dark:text-schappo-400">/{r.atalho}</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-full">
            {r.conteudo.length > 80 ? r.conteudo.slice(0, 80) + '...' : r.conteudo}
          </span>
        </button>
      ))}
    </div>
  );
}
