'use client';

import { useState } from 'react';
import { usePacienteInfo } from '@/hooks/usePacienteInfo';

interface PacienteBannerProps {
  telefone: string | null;
  tipo: 'individual' | 'grupo';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function statusLabel(status: string | null): { text: string; color: string } {
  switch (status) {
    case 'C': return { text: 'Confirmado', color: 'text-green-400' };
    case 'F': return { text: 'Faltou', color: 'text-red-400' };
    case 'M': return { text: 'Marcado', color: 'text-blue-400' };
    case 'A': return { text: 'Compareceu', color: 'text-green-400' };
    case 'R': return { text: 'Remarcado', color: 'text-yellow-400' };
    default: return { text: status || 'Pendente', color: 'text-gray-400' };
  }
}

export default function PacienteBanner({ telefone, tipo }: PacienteBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const { data, loading } = usePacienteInfo(tipo === 'individual' ? telefone : null);

  // Nao mostrar para grupos ou enquanto carrega sem resultado
  if (tipo === 'grupo') return null;
  if (loading && !data) return null;
  if (!data) return null;

  if (!data.encontrado) {
    return (
      <div className="px-4 py-1.5 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <span className="text-xs text-gray-400">Novo contato — paciente nao encontrado no Konsyst</span>
      </div>
    );
  }

  const pac = data.paciente!;
  const prox = data.proximo;
  const historico = data.historico || [];

  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      {/* Banner compacto */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-1.5 bg-gray-100 dark:bg-gray-900 flex items-center gap-3 text-xs hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
      >
        {/* Indicador */}
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* Nome paciente */}
        <span className="font-medium text-gray-700 dark:text-gray-300">{pac.nome}</span>

        {/* Proximo agendamento */}
        {prox && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-green-400">
              Proximo: {formatDate(prox.data)} {prox.hora} — {prox.medico}
            </span>
          </span>
        )}

        {/* Sem proximo */}
        {!prox && historico.length > 0 && (
          <span className="ml-auto text-gray-500">Sem agendamento futuro</span>
        )}
      </button>

      {/* Expandido: historico */}
      {expanded && historico.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
          <div className="text-[10px] text-gray-500 uppercase font-medium mb-1.5">Ultimos agendamentos</div>
          <div className="space-y-1">
            {historico.map((h, i) => {
              const st = statusLabel(h.status);
              return (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400 font-mono w-20">{formatDate(h.data)}</span>
                  <span className="text-gray-400 w-12">{h.hora}</span>
                  <span className="text-gray-300 flex-1 truncate">{h.medico} — {h.procedimento}</span>
                  <span className={st.color}>{st.text}</span>
                </div>
              );
            })}
          </div>
          {pac.responsavel && (
            <div className="mt-2 text-xs text-gray-500">Responsavel: {pac.responsavel}</div>
          )}
        </div>
      )}
    </div>
  );
}
