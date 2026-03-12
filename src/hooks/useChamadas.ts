'use client';

import { useCallback } from 'react';
import { Chamada } from '@/lib/types';
import { useFetchList } from './useFetchList';

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
  const { items, total, loading, error, refresh, setItems } = useFetchList<Chamada>({
    url: '/api/chamadas',
    params: { origem: params.origem, status: params.status },
    dataKey: 'chamadas',
    totalKey: 'total',
  });

  const addChamada = useCallback((chamada: Chamada) => {
    setItems((prev) => [chamada, ...prev]);
  }, [setItems]);

  const updateChamada = useCallback((chamadaId: number, updates: Partial<Chamada>) => {
    setItems((prev) =>
      prev.map((c) => (c.id === chamadaId ? { ...c, ...updates } : c)),
    );
  }, [setItems]);

  return { chamadas: items, total, loading, error, refresh, addChamada, updateChamada };
}
