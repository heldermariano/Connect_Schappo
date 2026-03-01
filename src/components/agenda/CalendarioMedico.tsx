'use client';

import { useState, useEffect, useCallback } from 'react';

interface CalendarioMedicoProps {
  medicoId: number | null;
  dataSelecionada: string; // YYYY-MM-DD
  onSelectDate: (data: string) => void;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function CalendarioMedico({ medicoId, dataSelecionada, onSelectDate }: CalendarioMedicoProps) {
  const today = new Date();
  const [mesAtual, setMesAtual] = useState(() => {
    if (dataSelecionada) {
      const [y, m] = dataSelecionada.split('-');
      return { year: parseInt(y), month: parseInt(m) };
    }
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  });
  const [diasAtendimento, setDiasAtendimento] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchDias = useCallback(async () => {
    if (!medicoId) {
      setDiasAtendimento(new Set());
      return;
    }
    setLoading(true);
    try {
      const mesStr = `${mesAtual.year}-${pad(mesAtual.month)}`;
      const res = await fetch(`/api/agenda/dias-atendimento?medico=${medicoId}&mes=${mesStr}`);
      if (res.ok) {
        const data = await res.json();
        setDiasAtendimento(new Set(data.dias));
      }
    } catch {
      // silenciar
    } finally {
      setLoading(false);
    }
  }, [medicoId, mesAtual]);

  useEffect(() => {
    fetchDias();
  }, [fetchDias]);

  // Gerar grid do mes
  const primeiroDia = new Date(mesAtual.year, mesAtual.month - 1, 1);
  const ultimoDia = new Date(mesAtual.year, mesAtual.month, 0);
  const diasNoMes = ultimoDia.getDate();
  const diaSemanaInicio = primeiroDia.getDay(); // 0=Dom

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const navMes = (delta: number) => {
    setMesAtual(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 12) { m = 1; y++; }
      if (m < 1) { m = 12; y--; }
      return { year: y, month: m };
    });
  };

  const handleClick = (dia: number) => {
    const dataStr = `${mesAtual.year}-${pad(mesAtual.month)}-${pad(dia)}`;
    onSelectDate(dataStr);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 w-[280px]">
      {/* Navegacao do mes */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navMes(-1)}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-white">
          {MESES[mesAtual.month - 1]} {mesAtual.year}
        </span>
        <button
          onClick={() => navMes(1)}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-[10px] text-gray-500 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Espacos vazios antes do primeiro dia */}
        {Array.from({ length: diaSemanaInicio }, (_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}

        {/* Dias do mes */}
        {Array.from({ length: diasNoMes }, (_, i) => {
          const dia = i + 1;
          const dataStr = `${mesAtual.year}-${pad(mesAtual.month)}-${pad(dia)}`;
          const isToday = dataStr === todayStr;
          const isSelected = dataStr === dataSelecionada;
          const hasAtendimento = diasAtendimento.has(dataStr);

          return (
            <button
              key={dia}
              onClick={() => handleClick(dia)}
              className={`h-8 rounded text-xs font-medium transition-all relative ${
                isSelected
                  ? 'bg-schappo-500 text-white'
                  : hasAtendimento
                    ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                    : isToday
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {dia}
              {hasAtendimento && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center mt-2">
          <span className="text-[10px] text-gray-500">Carregando...</span>
        </div>
      )}

      {/* Legenda */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-700">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-[10px] text-gray-500">Com pacientes</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-schappo-500" />
          <span className="text-[10px] text-gray-500">Selecionado</span>
        </div>
      </div>
    </div>
  );
}
