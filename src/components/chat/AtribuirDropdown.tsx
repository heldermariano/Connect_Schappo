'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Atendente } from '@/lib/types';

interface AtribuirDropdownProps {
  conversaId: number;
  atendenteId: number | null;
  atendenteNome?: string | null;
  onAtribuir: (conversaId: number, atendenteId: number | null) => void;
}

export default function AtribuirDropdown({
  conversaId,
  atendenteId,
  atendenteNome,
  onAtribuir,
}: AtribuirDropdownProps) {
  const [open, setOpen] = useState(false);
  const [atendentes, setAtendentes] = useState<Atendente[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Carregar atendentes ao abrir
  const handleOpen = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);

    if (atendentes.length > 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/atendentes/status');
      if (res.ok) {
        const data = await res.json();
        setAtendentes(data.atendentes || []);
      }
    } catch {
      // Silenciar erro
    } finally {
      setLoading(false);
    }
  }, [open, atendentes.length]);

  const handleSelect = useCallback(
    async (newAtendenteId: number | null) => {
      setOpen(false);
      try {
        const res = await fetch(`/api/conversas/${conversaId}/atribuir`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ atendente_id: newAtendenteId }),
        });
        if (res.ok) {
          onAtribuir(conversaId, newAtendenteId);
        }
      } catch {
        // Silenciar erro
      }
    },
    [conversaId, onAtribuir],
  );

  const displayName = atendenteNome || (atendenteId ? `Atendente #${atendenteId}` : null);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-md
                   border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400
                   transition-colors"
        title="Atribuir atendente"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="max-w-[100px] truncate">
          {displayName || 'Atribuir'}
        </span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-black rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 z-50 py-1">
          {loading ? (
            <div className="px-3 py-2 text-xs text-gray-400">Carregando...</div>
          ) : (
            <>
              {atendenteId && (
                <button
                  onClick={() => handleSelect(null)}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
                >
                  Remover atribuicao
                </button>
              )}
              {atendentes
                .filter((a) => a.ativo)
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSelect(a.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                      ${a.id === atendenteId ? 'text-schappo-600 font-medium bg-schappo-50' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    {a.nome}
                    {a.ramal && <span className="text-gray-400 ml-1">({a.ramal})</span>}
                  </button>
                ))}
              {atendentes.filter((a) => a.ativo).length === 0 && !loading && (
                <div className="px-3 py-2 text-xs text-gray-400">Nenhum atendente ativo</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
