'use client';

import { useState, useEffect, useCallback } from 'react';
import { RespostaPronta } from '@/lib/types';

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
  const [respostas, setRespostas] = useState<RespostaPronta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRespostas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/respostas-prontas');
      if (!res.ok) throw new Error('Erro ao carregar respostas');
      const data = await res.json();
      setRespostas(data.respostas);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRespostas();
  }, [fetchRespostas]);

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
    await fetchRespostas();
  }, [fetchRespostas]);

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
    await fetchRespostas();
  }, [fetchRespostas]);

  const deleteResposta = useCallback(async (id: number) => {
    const res = await fetch(`/api/respostas-prontas/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao excluir resposta');
    }
    await fetchRespostas();
  }, [fetchRespostas]);

  return {
    respostas,
    loading,
    error,
    refresh: fetchRespostas,
    addResposta,
    updateResposta,
    deleteResposta,
  };
}
