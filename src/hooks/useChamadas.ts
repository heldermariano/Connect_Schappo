'use client';

import { useState, useEffect, useCallback } from 'react';
import { Chamada } from '@/lib/types';

interface UseChamadasParams {
  origem?: string;
  status?: string;
}

interface UseChamadasResult {
  chamadas: Chamada[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  addChamada: (chamada: Chamada) => void;
  updateChamada: (chamadaId: number, updates: Partial<Chamada>) => void;
}

export function useChamadas(params: UseChamadasParams = {}): UseChamadasResult {
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChamadas = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (params.origem) query.set('origem', params.origem);
      if (params.status) query.set('status', params.status);

      const res = await fetch(`/api/chamadas?${query.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar chamadas');

      const data = await res.json();
      setChamadas(data.chamadas);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [params.origem, params.status]);

  useEffect(() => {
    fetchChamadas();
  }, [fetchChamadas]);

  const addChamada = useCallback((chamada: Chamada) => {
    setChamadas((prev) => [chamada, ...prev]);
    setTotal((prev) => prev + 1);
  }, []);

  const updateChamada = useCallback((chamadaId: number, updates: Partial<Chamada>) => {
    setChamadas((prev) =>
      prev.map((c) => (c.id === chamadaId ? { ...c, ...updates } : c)),
    );
  }, []);

  return { chamadas, total, loading, error, refresh: fetchChamadas, addChamada, updateChamada };
}
