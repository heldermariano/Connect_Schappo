'use client';

import { useState, useEffect, useCallback } from 'react';
import { Contato } from '@/lib/types';

interface UseContatosResult {
  contatos: Contato[];
  total: number;
  loading: boolean;
  error: string | null;
  busca: string;
  setBusca: (v: string) => void;
  refresh: () => void;
  syncing: boolean;
  syncResult: { fetched: number; updated: number } | null;
  sync: () => Promise<void>;
}

export function useContatos(): UseContatosResult {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ fetched: number; updated: number } | null>(null);

  const fetchContatos = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (busca) query.set('busca', busca);

      const res = await fetch(`/api/contatos?${query.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar contatos');

      const data = await res.json();
      setContatos(data.contatos);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [busca]);

  useEffect(() => {
    fetchContatos();
  }, [fetchContatos]);

  const sync = useCallback(async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      const res = await fetch('/api/contatos/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Erro ao sincronizar');
      const data = await res.json();
      setSyncResult(data);
      // Recarregar lista apos sync
      await fetchContatos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  }, [fetchContatos]);

  return { contatos, total, loading, error, busca, setBusca, refresh: fetchContatos, syncing, syncResult, sync };
}
