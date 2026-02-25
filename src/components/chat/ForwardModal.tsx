'use client';

import { useState, useEffect, useCallback } from 'react';
import { Conversa, Mensagem } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

interface ForwardModalProps {
  mensagem: Mensagem;
  onClose: () => void;
}

export default function ForwardModal({ mensagem, onClose }: ForwardModalProps) {
  const [busca, setBusca] = useState('');
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<Conversa | null>(null);

  // Fetch conversas
  useEffect(() => {
    const fetchConversas = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (busca.trim()) params.set('busca', busca.trim());
        const res = await fetch(`/api/conversas?${params}`);
        if (res.ok) {
          const data = await res.json();
          setConversas(data.conversas || []);
        }
      } catch {
        // Silenciar erro
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchConversas, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const handleForward = useCallback(async () => {
    if (!selected) return;
    setSending(true);
    try {
      const res = await fetch('/api/mensagens/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_message_id: mensagem.id,
          target_conversa_id: selected.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erro ao encaminhar' }));
        alert(data.error || 'Erro ao encaminhar mensagem');
        return;
      }
      onClose();
    } catch {
      alert('Erro ao encaminhar mensagem');
    } finally {
      setSending(false);
    }
  }, [mensagem, selected, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const preview = mensagem.conteudo?.slice(0, 80) || `[${mensagem.tipo_mensagem}]`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-black rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Encaminhar mensagem</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Preview da mensagem */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-400">Mensagem:</div>
          <div className="text-sm text-gray-700 dark:text-gray-300 truncate">{preview}</div>
        </div>

        {/* Busca */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Lista de conversas */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : conversas.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">Nenhuma conversa encontrada</div>
          ) : (
            conversas.map((c) => {
              const name = c.tipo === 'grupo'
                ? c.nome_grupo || 'Grupo'
                : c.nome_contato || c.telefone || 'Desconhecido';
              const isSelected = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(isSelected ? null : c)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    isSelected ? 'bg-schappo-50 dark:bg-schappo-500/15 border-l-2 border-schappo-500' : ''
                  }`}
                >
                  <Avatar nome={name} avatarUrl={c.avatar_url} size="sm" isGroup={c.tipo === 'grupo'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{name}</div>
                    <div className="text-xs text-gray-400">{c.categoria} &middot; {c.provider}</div>
                  </div>
                  {isSelected && (
                    <svg className="w-5 h-5 text-schappo-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleForward}
            disabled={!selected || sending}
            className="px-4 py-2 text-sm font-medium text-white bg-schappo-600 rounded-lg
                       hover:bg-schappo-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                       transition-colors"
          >
            {sending ? 'Enviando...' : 'Encaminhar'}
          </button>
        </div>
      </div>
    </div>
  );
}
