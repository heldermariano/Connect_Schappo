'use client';

import { useState, useEffect, useCallback } from 'react';
import { Conversa } from '@/lib/types';

interface UseConversasParams {
  categoria?: string;
  tipo?: string;
  pendentes?: string;
  busca?: string;
}

interface UseConversasResult {
  conversas: Conversa[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  updateConversa: (conversaId: number, updates: Partial<Conversa>) => void;
  marcarComoLida: (conversaId: number) => void;
}

export function useConversas(params: UseConversasParams = {}): UseConversasResult {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversas = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (params.categoria) query.set('categoria', params.categoria);
      if (params.tipo) query.set('tipo', params.tipo);
      if (params.pendentes) query.set('pendentes', params.pendentes);
      if (params.busca) query.set('busca', params.busca);

      const res = await fetch(`/api/conversas?${query.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar conversas');

      const data = await res.json();
      setConversas(data.conversas);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [params.categoria, params.tipo, params.pendentes, params.busca]);

  useEffect(() => {
    fetchConversas();
  }, [fetchConversas]);

  const updateConversa = useCallback((conversaId: number, updates: Partial<Conversa>) => {
    setConversas((prev) =>
      prev
        .map((c) => (c.id === conversaId ? { ...c, ...updates } : c))
        .sort((a, b) => {
          const aTime = a.ultima_msg_at ? new Date(a.ultima_msg_at).getTime() : 0;
          const bTime = b.ultima_msg_at ? new Date(b.ultima_msg_at).getTime() : 0;
          return bTime - aTime;
        }),
    );
  }, []);

  const marcarComoLida = useCallback((conversaId: number) => {
    // Atualizar localmente
    updateConversa(conversaId, { nao_lida: 0 });
    // Chamar API (fire-and-forget)
    fetch(`/api/conversas/${conversaId}/read`, { method: 'PATCH' }).catch(() => {
      // Silenciar erro — o update local ja foi feito
    });
  }, [updateConversa]);

  return { conversas, total, loading, error, refresh: fetchConversas, updateConversa, marcarComoLida };
}
