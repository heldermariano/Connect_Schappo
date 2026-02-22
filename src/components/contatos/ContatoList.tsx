'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Contato } from '@/lib/types';
import ContatoItem from './ContatoItem';

interface ContatoListProps {
  contatos: Contato[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onSelect: (contato: Contato) => void;
}

export default function ContatoList({ contatos, loading, loadingMore, hasMore, onLoadMore, onSelect }: ContatoListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore || loadingMore || !onLoadMore) return;
    // Carregar mais quando chegar perto do fim (200px)
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (contatos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4 text-center">
        Nenhum contato encontrado
      </div>
    );
  }

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto">
      {contatos.map((contato, idx) => (
        <ContatoItem
          key={`${contato.telefone}-${idx}`}
          contato={contato}
          onClick={() => onSelect(contato)}
        />
      ))}
      {loadingMore && (
        <div className="py-3 text-center text-xs text-gray-400">
          Carregando mais...
        </div>
      )}
      {!hasMore && contatos.length > 0 && (
        <div className="py-3 text-center text-xs text-gray-300">
          {contatos.length} contatos carregados
        </div>
      )}
    </div>
  );
}
