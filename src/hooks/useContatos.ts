'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Contato } from '@/lib/types';

interface UseContatosResult {
  contatos: Contato[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  busca: string;
  setBusca: (v: string) => void;
  refresh: () => void;
  loadMore: () => void;
  hasMore: boolean;
  syncing: boolean;
  syncResult: { processed: number; updated: number; errors: number } | null;
  sync: () => Promise<void>;
}

export function useContatos(): UseContatosResult {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ processed: number; updated: number; errors: number } | null>(null);
  const pageRef = useRef(1);

  const fetchContatos = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      const query = new URLSearchParams();
      if (busca) query.set('busca', busca);
      query.set('page', String(page));
      query.set('limit', '100');

      const res = await fetch(`/api/contatos?${query.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar contatos');

      const data = await res.json();

      if (append) {
        setContatos((prev) => [...prev, ...data.contatos]);
      } else {
        setContatos(data.contatos);
      }
      setTotal(data.total);
      setHasMore(data.hasMore);
      pageRef.current = page;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [busca]);

  useEffect(() => {
    pageRef.current = 1;
    fetchContatos(1, false);
  }, [fetchContatos]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchContatos(pageRef.current + 1, true);
    }
  }, [loadingMore, hasMore, fetchContatos]);

  const sync = useCallback(async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      const res = await fetch('/api/contatos/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Erro ao sincronizar');
      const data = await res.json();
      setSyncResult(data);
      await fetchContatos(1, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  }, [fetchContatos]);

  return {
    contatos, total, loading, loadingMore, error, busca, setBusca,
    refresh: () => fetchContatos(1, false),
    loadMore, hasMore,
    syncing, syncResult, sync,
  };
}
