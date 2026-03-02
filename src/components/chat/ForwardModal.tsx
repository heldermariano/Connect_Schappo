'use client';

import { useState, useEffect, useCallback } from 'react';
import { Conversa, Mensagem } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

interface ForwardModalProps {
  mensagens: Mensagem[];
  onClose: () => void;
}

export default function ForwardModal({ mensagens, onClose }: ForwardModalProps) {
  const [busca, setBusca] = useState('');
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
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
    if (!selected || mensagens.length === 0) return;
    setSending(true);
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;

    // Encaminhar mensagens em ordem cronologica
    const sorted = [...mensagens].sort((a, b) => a.id - b.id);

    for (let i = 0; i < sorted.length; i++) {
      // Delay entre envios para evitar rate limiting do provider
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      try {
        console.log(`[forward] Enviando ${i + 1}/${sorted.length}: msgId=${sorted[i].id} para conversa=${selected.id}`);
        const res = await fetch('/api/mensagens/forward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_message_id: sorted[i].id,
            target_conversa_id: selected.id,
          }),
        });
        if (res.ok) {
          successCount++;
        } else {
          const err = await res.json().catch(() => ({}));
          console.error(`[forward] Erro msg ${sorted[i].id}: status=${res.status}`, err);
          errorCount++;
        }
      } catch (err) {
        console.error(`[forward] Erro rede msg ${sorted[i].id}:`, err);
        errorCount++;
      }
      setProgress(i + 1);
    }

    if (errorCount > 0 && successCount === 0) {
      alert('Erro ao encaminhar mensagens');
    } else if (errorCount > 0) {
      alert(`${successCount} encaminhada(s), ${errorCount} com erro`);
    }

    setSending(false);
    onClose();
  }, [mensagens, selected, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !sending) onClose();
  }, [onClose, sending]);

  const count = mensagens.length;
  const previewText = count === 1
    ? (mensagens[0].conteudo?.slice(0, 80) || `[${mensagens[0].tipo_mensagem}]`)
    : `${count} mensagens selecionadas`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-black rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Encaminhar {count > 1 ? `${count} mensagens` : 'mensagem'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Preview da mensagem */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-800">
          <div className="text-xs text-gray-400">{count > 1 ? 'Mensagens:' : 'Mensagem:'}</div>
          <div className="text-sm text-gray-700 dark:text-gray-300 truncate">{previewText}</div>
        </div>

        {/* Busca */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800">
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
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          {sending && count > 1 && (
            <span className="text-xs text-gray-400 mr-auto">{progress}/{count}</span>
          )}
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
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
            {sending ? 'Enviando...' : count > 1 ? `Encaminhar ${count}` : 'Encaminhar'}
          </button>
        </div>
      </div>
    </div>
  );
}
