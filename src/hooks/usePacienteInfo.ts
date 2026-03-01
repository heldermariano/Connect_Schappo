'use client';

import { useState, useEffect } from 'react';

interface PacienteInfo {
  cod_paciente: number;
  nome: string;
  nascimento: string | null;
  responsavel: string | null;
  email: string | null;
}

interface AgendamentoInfo {
  data: string | null;
  hora: string;
  medico: string;
  procedimento: string;
  status: string | null;
}

interface PacienteData {
  encontrado: boolean;
  paciente?: PacienteInfo;
  proximo?: AgendamentoInfo | null;
  historico?: AgendamentoInfo[];
}

export function usePacienteInfo(telefone: string | null) {
  const [data, setData] = useState<PacienteData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!telefone) {
      setData(null);
      return;
    }

    let cancelled = false;
    const fetchPaciente = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/agenda/paciente?telefone=${encodeURIComponent(telefone)}`);
        if (!res.ok) {
          setData(null);
          return;
        }
        const result = await res.json();
        if (!cancelled) {
          setData(result);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPaciente();
    return () => { cancelled = true; };
  }, [telefone]);

  return { data, loading };
}
