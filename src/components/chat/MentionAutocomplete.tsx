'use client';

import { useEffect, useRef, useState } from 'react';
import Avatar from '@/components/ui/Avatar';

export interface Participant {
  phone: string;
  nome: string;
  avatar_url?: string | null;
  lid?: string | null; // WhatsApp Linked ID (para mentionedJid)
}

interface MentionAutocompleteProps {
  query: string;
  participants: Participant[];
  onSelect: (participant: Participant) => void;
  onClose: () => void;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return phone;
}

export default function MentionAutocomplete({
  query,
  participants,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = normalize(query);
  const filtered = participants.filter((p) => {
    if (!normalizedQuery) return true;
    return (
      normalize(p.nome).includes(normalizedQuery) ||
      p.phone.includes(query)
    );
  }).slice(0, 6);

  // Reset index quando filtro muda
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll item selecionado para visivel
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard handler (chamado pelo pai via ref ou event bubbling)
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
      <div className="absolute bottom-full left-0 right-0 mb-1 mx-4 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
        <span className="text-sm text-gray-400">Nenhum participante encontrado</span>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 mx-4 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto z-50"
      style={{ maxHeight: '240px' }}
    >
      {filtered.map((p, i) => (
        <button
          key={p.phone}
          type="button"
          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors
            ${i === selectedIndex ? 'bg-schappo-50' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault(); // Evitar perda de focus do textarea
            onSelect(p);
          }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <Avatar nome={p.nome} avatarUrl={p.avatar_url} size="xs" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{p.nome}</div>
            <div className="text-[11px] text-gray-400 truncate">{formatPhone(p.phone)}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
