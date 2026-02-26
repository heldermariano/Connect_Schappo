'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChatInterno, ChatInternoMensagem } from '@/lib/types';

export function useChatInterno() {
  const [chats, setChats] = useState<ChatInterno[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch('/api/chat-interno');
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats);
      }
    } catch (err) {
      console.error('[useChatInterno] Erro:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const criarChat = useCallback(async (destinatarioId: number): Promise<ChatInterno | null> => {
    try {
      const res = await fetch('/api/chat-interno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinatario_id: destinatarioId }),
      });
      if (res.ok) {
        const data = await res.json();
        // Adicionar ao topo se nao existir
        setChats((prev) => {
          const exists = prev.find((c) => c.id === data.chat.id);
          if (exists) return prev;
          return [data.chat, ...prev];
        });
        return data.chat;
      }
    } catch (err) {
      console.error('[useChatInterno] Erro ao criar:', err);
    }
    return null;
  }, []);

  const updateChat = useCallback((chatId: number, updates: Partial<ChatInterno>) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, ...updates } : c))
        .sort((a, b) => {
          const ta = a.ultima_msg_at ? new Date(a.ultima_msg_at).getTime() : 0;
          const tb = b.ultima_msg_at ? new Date(b.ultima_msg_at).getTime() : 0;
          return tb - ta;
        }),
    );
  }, []);

  return { chats, loading, fetchChats, criarChat, updateChat };
}

export function useChatInternoMensagens(chatId: number | null) {
  const [mensagens, setMensagens] = useState<ChatInternoMensagem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!chatId) {
      setMensagens([]);
      return;
    }

    setLoading(true);
    fetch(`/api/chat-interno/${chatId}/mensagens`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setMensagens(data.mensagens);
          setHasMore(data.hasMore);
        }
      })
      .catch((err) => console.error('[useChatInternoMensagens] Erro:', err))
      .finally(() => setLoading(false));
  }, [chatId]);

  const addMensagem = useCallback((msg: ChatInternoMensagem) => {
    setMensagens((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const sendMensagem = useCallback(async (chatId: number, conteudo: string, replyToId?: number) => {
    try {
      const res = await fetch(`/api/chat-interno/${chatId}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo, reply_to_id: replyToId }),
      });
      if (res.ok) {
        const data = await res.json();
        addMensagem(data.mensagem);
        return data.mensagem;
      }
    } catch (err) {
      console.error('[useChatInternoMensagens] Erro ao enviar:', err);
    }
    return null;
  }, [addMensagem]);

  const sendMedia = useCallback(async (chatId: number, file: File, caption?: string, voiceRecording?: boolean, replyToId?: number) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (caption) formData.append('caption', caption);
      if (voiceRecording) formData.append('voice_recording', 'true');
      if (replyToId) formData.append('reply_to_id', replyToId.toString());

      const res = await fetch(`/api/chat-interno/${chatId}/media`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        addMensagem(data.mensagem);
        return data.mensagem;
      }
    } catch (err) {
      console.error('[useChatInternoMensagens] Erro ao enviar media:', err);
    }
    return null;
  }, [addMensagem]);

  const reactToMessage = useCallback(async (chatId: number, mensagemId: number, emoji: string) => {
    try {
      const res = await fetch(`/api/chat-interno/${chatId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem_id: mensagemId, emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        // Atualizar reacoes na mensagem localmente
        setMensagens((prev) =>
          prev.map((m) => m.id === mensagemId ? { ...m, reacoes: data.reacoes } : m),
        );
        return data.reacoes;
      }
    } catch (err) {
      console.error('[useChatInternoMensagens] Erro ao reagir:', err);
    }
    return null;
  }, []);

  const updateMessageReacoes = useCallback((mensagemId: number, reacoes: Array<{ emoji: string; atendente_id: number; nome: string }>) => {
    setMensagens((prev) =>
      prev.map((m) => m.id === mensagemId ? { ...m, reacoes } : m),
    );
  }, []);

  return { mensagens, loading, hasMore, addMensagem, sendMensagem, sendMedia, reactToMessage, updateMessageReacoes };
}
