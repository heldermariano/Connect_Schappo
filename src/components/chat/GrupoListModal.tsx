'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Conversa } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

interface GrupoListModalProps {
  open: boolean;
  canal: string;
  onClose: () => void;
  onSelectGrupo: (conversa: Conversa) => void;
}

export default function GrupoListModal({ open, canal, onClose, onSelectGrupo }: GrupoListModalProps) {
  const [grupos, setGrupos] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [busca, setBusca] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const syncAndFetch = useCallback(async () => {
    setLoading(true);
    setSyncing(true);
    setError(null);

    try {
      // 1. Sincronizar grupos da UAZAPI
      const syncRes = await fetch('/api/grupos/sync', { method: 'POST' });
      if (!syncRes.ok) {
        console.error('[GrupoListModal] Erro ao sincronizar:', syncRes.status);
      }
    } catch (err) {
      console.error('[GrupoListModal] Erro sync:', err);
    } finally {
      setSyncing(false);
    }

    try {
      // 2. Buscar todos os grupos do canal (incluindo arquivados)
      const res = await fetch(`/api/conversas?categoria=${canal}&tipo=grupo&limit=200`);
      if (!res.ok) throw new Error('Erro ao carregar grupos');

      const data = await res.json();
      // Ordenar por nome do grupo
      const sorted = (data.conversas || []).sort((a: Conversa, b: Conversa) => {
        const nA = (a.nome_grupo || '').toLowerCase();
        const nB = (b.nome_grupo || '').toLowerCase();
        return nA.localeCompare(nB);
      });
      setGrupos(sorted);
    } catch (err) {
      setError('Erro ao carregar lista de grupos');
      console.error('[GrupoListModal] Erro fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [canal]);

  useEffect(() => {
    if (open) {
      syncAndFetch();
      setBusca('');
      // Focus no input apos abrir
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, syncAndFetch]);

  // Fechar com Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  // Filtro client-side
  const filtered = busca.trim()
    ? grupos.filter((g) =>
        (g.nome_grupo || '').toLowerCase().includes(busca.toLowerCase()),
      )
    : grupos;

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Grupos do canal
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Busca */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar grupo..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-schappo-500"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="w-6 h-6 border-2 border-schappo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-500">
                {syncing ? 'Sincronizando grupos...' : 'Carregando...'}
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="text-sm text-red-500">{error}</span>
              <button
                onClick={syncAndFetch}
                className="text-xs text-schappo-600 hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-gray-400">
                {busca ? 'Nenhum grupo encontrado' : 'Nenhum grupo neste canal'}
              </span>
            </div>
          ) : (
            <div className="py-1">
              {filtered.map((grupo) => (
                <button
                  key={grupo.id}
                  onClick={() => onSelectGrupo(grupo)}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Avatar nome={grupo.nome_grupo || 'Grupo'} avatarUrl={grupo.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {grupo.nome_grupo || 'Grupo'}
                    </div>
                    {grupo.ultima_mensagem && (
                      <div className="text-xs text-gray-400 truncate">
                        {grupo.ultima_mensagem}
                      </div>
                    )}
                  </div>
                  {grupo.nao_lida > 0 && (
                    <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-schappo-500 text-white rounded-full shrink-0">
                      {grupo.nao_lida > 99 ? '99+' : grupo.nao_lida}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer com contagem */}
        {!loading && !error && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-center">
            <span className="text-[10px] text-gray-400">
              {filtered.length} grupo{filtered.length !== 1 ? 's' : ''}
              {busca && ` encontrado${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
