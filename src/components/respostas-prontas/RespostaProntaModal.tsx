'use client';

import { useState, useEffect } from 'react';
import { RespostaPronta } from '@/lib/types';

interface RespostaProntaModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (atalho: string, conteudo: string) => Promise<void>;
  resposta?: RespostaPronta | null;
}

export default function RespostaProntaModal({ open, onClose, onSave, resposta }: RespostaProntaModalProps) {
  const [atalho, setAtalho] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!resposta;

  useEffect(() => {
    if (open) {
      setAtalho(resposta?.atalho || '');
      setConteudo(resposta?.conteudo || '');
      setError(null);
    }
  }, [open, resposta]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!atalho.trim() || !conteudo.trim()) {
      setError('Preencha o atalho e a mensagem');
      return;
    }
    if (atalho.trim().length > 50) {
      setError('Atalho deve ter no maximo 50 caracteres');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await onSave(atalho.trim(), conteudo.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {isEditing ? 'Editar Resposta' : 'Nova Resposta'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Atalho</label>
            <div className="flex items-center">
              <span className="text-gray-400 dark:text-gray-500 mr-1 text-lg font-mono">/</span>
              <input
                type="text"
                value={atalho}
                onChange={(e) => setAtalho(e.target.value.replace(/\s/g, ''))}
                placeholder="preparo-eeg"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
                autoFocus
                maxLength={50}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Sem espacos, max 50 caracteres</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem</label>
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Texto completo da resposta..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-schappo-500 rounded-lg hover:bg-schappo-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
