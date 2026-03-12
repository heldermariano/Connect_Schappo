'use client';

import { useCallback } from 'react';
import { RespostaPronta } from '@/lib/types';
import { useFetchList } from './useFetchList';

interface UseRespostasProntasResult {
  respostas: RespostaPronta[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  addResposta: (atalho: string, conteudo: string) => Promise<void>;
  updateResposta: (id: number, atalho: string, conteudo: string) => Promise<void>;
  deleteResposta: (id: number) => Promise<void>;
}

export function useRespostasProntas(): UseRespostasProntasResult {
  const { items, loading, error, refresh } = useFetchList<RespostaPronta>({
    url: '/api/respostas-prontas',
    dataKey: 'respostas',
  });

  const addResposta = useCallback(async (atalho: string, conteudo: string) => {
    const res = await fetch('/api/respostas-prontas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atalho, conteudo }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao criar resposta');
    }
    await refresh();
  }, [refresh]);

  const updateResposta = useCallback(async (id: number, atalho: string, conteudo: string) => {
    const res = await fetch(`/api/respostas-prontas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atalho, conteudo }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao atualizar resposta');
    }
    await refresh();
  }, [refresh]);

  const deleteResposta = useCallback(async (id: number) => {
    const res = await fetch(`/api/respostas-prontas/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao excluir resposta');
    }
    await refresh();
  }, [refresh]);

  return {
    respostas: items,
    loading,
    error,
    refresh,
    addResposta,
    updateResposta,
    deleteResposta,
  };
}
