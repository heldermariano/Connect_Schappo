'use client';

import { useState, useEffect, useRef } from 'react';
import StatusBadge, { StatusPresenca } from '@/components/ui/StatusBadge';

interface OperadorInfo {
  id: number;
  nome: string;
  ramal: string | null;
  status_presenca: string;
}

interface BroadcastModalProps {
  open: boolean;
  currentUserId: number;
  onClose: () => void;
  onSend: (destinatarioIds: number[], conteudo: string) => Promise<void>;
}

export default function BroadcastModal({ open, currentUserId, onClose, onSend }: BroadcastModalProps) {
  const [atendentes, setAtendentes] = useState<OperadorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [conteudo, setConteudo] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setConteudo('');
    setError(null);
    setSending(false);
    setLoading(true);

    fetch('/api/atendentes/status')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.atendentes) {
          setAtendentes(data.atendentes.filter((a: OperadorInfo) => a.id !== currentUserId));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, currentUserId, onClose]);

  const toggleOperador = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === atendentes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(atendentes.map((a) => a.id)));
    }
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      setError('Selecione ao menos um operador');
      return;
    }
    if (!conteudo.trim()) {
      setError('Digite uma mensagem');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSend(Array.from(selectedIds), conteudo.trim());
      onClose();
    } catch {
      setError('Erro ao enviar broadcast');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  // Ordenar: online primeiro, depois por nome
  const sorted = [...atendentes].sort((a, b) => {
    const statusOrder: Record<string, number> = { disponivel: 0, pausa: 1, almoco: 1, cafe: 1, lanche: 1, offline: 3 };
    const sa = statusOrder[a.status_presenca] ?? 3;
    const sb = statusOrder[b.status_presenca] ?? 3;
    if (sa !== sb) return sa - sb;
    return a.nome.localeCompare(b.nome);
  });

  const allSelected = atendentes.length > 0 && selectedIds.size === atendentes.length;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-black rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-schappo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Broadcast</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Selecionar todos */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500">
            {selectedIds.size} de {atendentes.length} selecionados
          </span>
          <button
            onClick={toggleAll}
            className="text-xs font-medium text-schappo-600 hover:text-schappo-700"
          >
            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        </div>

        {/* Lista de operadores */}
        <div className="overflow-y-auto flex-1 min-h-0 max-h-48">
          {loading ? (
            <div className="py-6 text-center text-xs text-gray-400">Carregando operadores...</div>
          ) : atendentes.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">Nenhum operador disponivel</div>
          ) : (
            sorted.map((a) => {
              const checked = selectedIds.has(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleOperador(a.id)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                    checked ? 'bg-schappo-50 dark:bg-schappo-900/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    checked
                      ? 'bg-schappo-600 border-schappo-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {checked && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                    {a.nome.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  {/* Nome */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-900 dark:text-gray-100 truncate block">{a.nome}</span>
                  </div>

                  <StatusBadge status={(a.status_presenca || 'offline') as StatusPresenca} size="sm" />
                </button>
              );
            })
          )}
        </div>

        {/* Textarea da mensagem */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
          <textarea
            ref={textareaRef}
            value={conteudo}
            onChange={(e) => { setConteudo(e.target.value); setError(null); }}
            placeholder="Digite a mensagem para todos os operadores selecionados..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-schappo-500 resize-none"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selectedIds.size === 0 || !conteudo.trim()}
            className="px-3 py-1.5 text-sm font-medium text-white bg-schappo-600 rounded-lg hover:bg-schappo-700 disabled:opacity-50"
          >
            {sending
              ? 'Enviando...'
              : `Enviar para ${selectedIds.size} operador${selectedIds.size !== 1 ? 'es' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
