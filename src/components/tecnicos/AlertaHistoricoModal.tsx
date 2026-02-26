'use client';

import { useEffect } from 'react';
import { HubUsuario, EegAlertaFicha } from '@/lib/types';
import { useAlertasTecnico } from '@/hooks/useAlertasTecnico';

interface Props {
  open: boolean;
  onClose: () => void;
  tecnico: HubUsuario;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Nao informada';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AlertaHistoricoModal({ open, onClose, tecnico }: Props) {
  const { alertas, stats, loading, error, fetchAlertas } = useAlertasTecnico();

  useEffect(() => {
    if (open && tecnico) {
      fetchAlertas(tecnico.id);
    }
  }, [open, tecnico, fetchAlertas]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-schappo-500 rounded-t-xl text-white">
          <h2 className="text-base font-semibold">{tecnico.nome}</h2>
          <div className="flex items-center gap-3 text-xs text-white/80 mt-0.5">
            <span>{tecnico.telefone}</span>
            <span>{tecnico.cargo}</span>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 dark:border-gray-800">
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              Total: {stats.total}
            </span>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              Pendentes: {stats.pendentes}
            </span>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              Corrigidos: {stats.corrigidos}
            </span>
          </div>
        )}

        {/* Lista de alertas */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <svg className="w-6 h-6 animate-spin text-schappo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {error && (
            <div className="text-center py-6 text-red-500 text-sm">{error}</div>
          )}

          {!loading && !error && alertas.length === 0 && (
            <div className="text-center py-8">
              <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhum alerta registrado</p>
            </div>
          )}

          {alertas.map((alerta: EegAlertaFicha) => (
            <AlertaCard key={alerta.id} alerta={alerta} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertaCard({ alerta }: { alerta: EegAlertaFicha }) {
  const progressPercent = alerta.total_campos > 0
    ? Math.round((alerta.total_campos_ok / alerta.total_campos) * 100)
    : 0;

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2">
      {/* Paciente + data exame */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {alerta.paciente_nome || 'Paciente nao informado'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Exame: {formatDate(alerta.data_exame)}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {alerta.corrigido ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              Corrigido
            </span>
          ) : (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              Pendente
            </span>
          )}
          {alerta.notificado_correcao && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
              Supervisao notificada
            </span>
          )}
        </div>
      </div>

      {/* Campos faltantes */}
      <div className="flex flex-wrap gap-1">
        {alerta.campos_faltantes.map((campo, i) => (
          <span
            key={i}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          >
            {campo}
          </span>
        ))}
      </div>

      {/* Barra de progresso */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              alerta.corrigido
                ? 'bg-green-500'
                : progressPercent >= 70
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 shrink-0">
          {alerta.total_campos_ok}/{alerta.total_campos}
        </span>
      </div>

      {/* Timestamps */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
        <span>Alerta: {formatDateTime(alerta.created_at)}</span>
        {alerta.corrigido && alerta.corrigido_at && (
          <span>Corrigido: {formatDateTime(alerta.corrigido_at)}</span>
        )}
      </div>
    </div>
  );
}
