'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mensagem } from '@/lib/types';

interface UseMensagensResult {
  mensagens: Mensagem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  addMensagem: (msg: Mensagem) => void;
  removeMensagem: (msgId: number) => void;
  sendMensagem: (conversaId: number, conteudo: string) => Promise<void>;
}

export function useMensagens(conversaId: number | null): UseMensagensResult {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchMensagens = useCallback(async () => {
    if (!conversaId) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/mensagens/${conversaId}`);
      if (!res.ok) throw new Error('Erro ao carregar mensagens');

      const data = await res.json();
      setMensagens(data.mensagens);
      setHasMore(data.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [conversaId]);

  useEffect(() => {
    setMensagens([]);
    fetchMensagens();
  }, [fetchMensagens]);

  const loadMore = useCallback(async () => {
    if (!conversaId || !hasMore || mensagens.length === 0) return;

    const oldestId = mensagens[0].id;
    try {
      const res = await fetch(`/api/mensagens/${conversaId}?before=${oldestId}`);
      if (!res.ok) return;

      const data = await res.json();
      setMensagens((prev) => [...data.mensagens, ...prev]);
      setHasMore(data.hasMore);
    } catch {
      // Silenciar erro de loadMore
    }
  }, [conversaId, hasMore, mensagens]);

  const addMensagem = useCallback((msg: Mensagem) => {
    setMensagens((prev) => {
      // Evitar duplicata
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const removeMensagem = useCallback((msgId: number) => {
    setMensagens((prev) => prev.filter((m) => m.id !== msgId));
  }, []);

  const sendMensagem = useCallback(async (cId: number, conteudo: string) => {
    const res = await fetch('/api/mensagens/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa_id: cId, conteudo }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Erro ao enviar' }));
      throw new Error(data.error || 'Erro ao enviar mensagem');
    }

    const data = await res.json();
    if (data.mensagem) {
      addMensagem(data.mensagem);
    }
  }, [addMensagem]);

  return { mensagens, loading, error, hasMore, loadMore, addMensagem, removeMensagem, sendMensagem };
}
