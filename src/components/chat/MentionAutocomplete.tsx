'use client';

import { useEffect, useRef, useCallback } from 'react';
import Avatar from '@/components/ui/Avatar';
import { useAutocomplete } from '@/hooks/useAutocomplete';

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
  const listRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = normalize(query);
  const filtered = participants.filter((p) => {
    if (!normalizedQuery) return true;
    return (
      normalize(p.nome).includes(normalizedQuery) ||
      p.phone.includes(query)
    );
  }).slice(0, 6);

  const handleSelect = useCallback((index: number) => {
    if (filtered[index]) onSelect(filtered[index]);
  }, [filtered, onSelect]);

  const { selectedIndex, setSelectedIndex } = useAutocomplete({
    trigger: '@',
    query,
    onClose,
    itemCount: filtered.length,
    onSelect: handleSelect,
  });

  // Scroll item selecionado para visivel
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

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
