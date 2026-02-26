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
  updateMensagem: (msgId: number, updatedFields: Partial<Mensagem>) => void;
  sendMensagem: (conversaId: number, conteudo: string, mencoes?: string[], quotedMsgId?: string) => Promise<void>;
  editMensagem: (conversaId: number, msgId: number, conteudo: string) => Promise<void>;
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
      // Inserir na posicao correta por id (manter ordem cronologica)
      const newList = [...prev, msg];
      // Se a nova mensagem tem id maior que a ultima, ja esta no lugar certo
      if (prev.length === 0 || msg.id > prev[prev.length - 1].id) return newList;
      // Caso contrario, ordenar por id
      newList.sort((a, b) => a.id - b.id);
      return newList;
    });
  }, []);

  const removeMensagem = useCallback((msgId: number) => {
    setMensagens((prev) => prev.filter((m) => m.id !== msgId));
  }, []);

  const updateMensagem = useCallback((msgId: number, updatedFields: Partial<Mensagem>) => {
    setMensagens((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, ...updatedFields } : m)),
    );
  }, []);

  const sendMensagem = useCallback(async (cId: number, conteudo: string, mencoes?: string[], quotedMsgId?: string) => {
    const body: Record<string, unknown> = { conversa_id: cId, conteudo };
    if (mencoes && mencoes.length > 0) {
      body.mencoes = mencoes;
    }
    if (quotedMsgId) {
      body.quoted_msg_id = quotedMsgId;
    }
    const res = await fetch('/api/mensagens/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

  const editMensagem = useCallback(async (cId: number, msgId: number, conteudo: string) => {
    const res = await fetch(`/api/mensagens/${cId}/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudo }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Erro ao editar' }));
      throw new Error(data.error || 'Erro ao editar mensagem');
    }

    const data = await res.json();
    if (data.mensagem) {
      updateMensagem(msgId, {
        conteudo: data.mensagem.conteudo,
        is_edited: true,
        edited_at: data.mensagem.edited_at,
      });
    }
  }, [updateMensagem]);

  return { mensagens, loading, error, hasMore, loadMore, addMensagem, removeMensagem, updateMensagem, sendMensagem, editMensagem };
}
