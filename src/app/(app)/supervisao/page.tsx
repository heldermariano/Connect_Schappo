'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useSSE } from '@/hooks/useSSE';
import StatusBadge, { type StatusPresenca } from '@/components/ui/StatusBadge';

interface SupervisaoAtendente {
  id: number;
  nome: string;
  status: string;
  grupo: string;
  conversas_pendentes: number;
  ultima_resposta_at: string | null;
  canal_mais_pendente: string | null;
  pausas_hoje: number;
  duracao_pausas_min: number;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}min`;
  return `${Math.floor(h / 24)}d`;
}

function getMinutesSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

export default function SupervisaoPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const userRole = (session?.user as { role?: string })?.role;
  const [atendentes, setAtendentes] = useState<SupervisaoAtendente[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/supervisao');
      if (res.ok) {
        const data = await res.json();
        setAtendentes(data.atendentes);
      }
    } catch (err) {
      console.error('Erro ao buscar supervisao:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole !== 'admin') {
      router.replace('/conversas');
      return;
    }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData, userRole, router]);

  // SSE: atualizar status em tempo real
  const handleSSE = useCallback((event: string, data: unknown) => {
    if (event === 'atendente_status') {
      const d = data as { atendente_id: number; status: string };
      setAtendentes((prev) =>
        prev.map((a) => (a.id === d.atendente_id ? { ...a, status: d.status } : a)),
      );
    }
  }, []);

  useSSE(handleSSE);

  if (userRole !== 'admin') return null;

  // Separar por status: online primeiro, depois offline
  const online = atendentes.filter((a) => a.status !== 'offline');
  const offline = atendentes.filter((a) => a.status === 'offline');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 bg-schappo-500 flex items-center px-6 shrink-0">
        <h1 className="text-white text-lg font-semibold">Supervisao</h1>
        <span className="ml-3 text-white/70 text-sm">
          {online.length} online / {atendentes.length} total
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-950">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500">Carregando...</div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Operador</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-center">Pendentes</th>
                  <th className="px-4 py-3 font-medium">Ultima Resposta</th>
                  <th className="px-4 py-3 font-medium text-center">Pausas Hoje</th>
                  <th className="px-4 py-3 font-medium">Tempo em Pausa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[...online, ...offline].map((a) => {
                  const minSemResposta = getMinutesSince(a.ultima_resposta_at);
                  const isInactive = a.status === 'disponivel' && minSemResposta > 10 && a.conversas_pendentes > 0;
                  const manyPauses = a.pausas_hoje > 3;

                  return (
                    <tr
                      key={a.id}
                      className={`transition-colors ${
                        isInactive
                          ? 'bg-red-50 dark:bg-red-950/30'
                          : manyPauses
                          ? 'bg-yellow-50 dark:bg-yellow-950/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{a.nome}</span>
                          <span className="text-[10px] text-gray-400 uppercase">{a.grupo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status as StatusPresenca} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.conversas_pendentes > 0 ? (
                          <span className={`inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-xs font-bold ${
                            isInactive ? 'bg-red-500 text-white' : 'bg-schappo-100 text-schappo-700 dark:bg-schappo-900/30 dark:text-schappo-400'
                          }`}>
                            {a.conversas_pendentes}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${
                          isInactive ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500'
                        }`}>
                          {formatTimeAgo(a.ultima_resposta_at)}
                          {isInactive && ' ⚠'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs ${manyPauses ? 'text-yellow-600 dark:text-yellow-400 font-semibold' : 'text-gray-500'}`}>
                          {a.pausas_hoje}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">
                          {a.duracao_pausas_min > 0 ? `${a.duracao_pausas_min} min` : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {atendentes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Nenhum operador cadastrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
