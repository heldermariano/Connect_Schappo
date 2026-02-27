'use client';

import { useState, useEffect } from 'react';
import StatusBadge, { StatusPresenca } from '@/components/ui/StatusBadge';

interface OperadorInfo {
  id: number;
  nome: string;
  ramal: string | null;
  status_presenca: string;
}

interface OperatorListProps {
  currentUserId: number;
  onSelect: (operador: OperadorInfo) => void;
}

export default function OperatorList({ currentUserId, onSelect }: OperatorListProps) {
  const [atendentes, setAtendentes] = useState<OperadorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/atendentes/status')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.atendentes) {
          setAtendentes(data.atendentes.filter((a: OperadorInfo) => a.id !== currentUserId));
        }
      })
      .catch((err) => console.error('[OperatorList] Erro:', err))
      .finally(() => setLoading(false));
  }, [currentUserId]);

  if (loading) {
    return <div className="px-3 py-4 text-xs text-gray-400 text-center">Carregando operadores...</div>;
  }

  if (atendentes.length === 0) {
    return <div className="px-3 py-4 text-xs text-gray-400 text-center">Nenhum operador disponivel</div>;
  }

  // Ordenar: online primeiro, depois por nome
  const sorted = [...atendentes].sort((a, b) => {
    const statusOrder: Record<string, number> = { disponivel: 0, pausa: 1, almoco: 1, cafe: 1, lanche: 1, offline: 3 };
    const sa = statusOrder[a.status_presenca as string] ?? 3;
    const sb = statusOrder[b.status_presenca as string] ?? 3;
    if (sa !== sb) return sa - sb;
    return a.nome.localeCompare(b.nome);
  });

  return (
    <div>
      <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        Operadores
      </div>
      {sorted.map((a) => (
        <button
          key={a.id}
          onClick={() => onSelect(a)}
          className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
            {a.nome.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-900 dark:text-gray-100 truncate block">{a.nome}</span>
          </div>
          <StatusBadge status={(a.status_presenca || 'offline') as StatusPresenca} size="sm" />
        </button>
      ))}
    </div>
  );
}
