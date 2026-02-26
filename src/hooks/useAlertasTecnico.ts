'use client';

import { useState, useCallback } from 'react';
import { EegAlertaFicha, TecnicoAlertasSummary } from '@/lib/types';

interface UseAlertasTecnicoResult {
  alertas: EegAlertaFicha[];
  stats: TecnicoAlertasSummary | null;
  loading: boolean;
  error: string | null;
  fetchAlertas: (tecnicoId: number) => Promise<void>;
}

export function useAlertasTecnico(): UseAlertasTecnicoResult {
  const [alertas, setAlertas] = useState<EegAlertaFicha[]>([]);
  const [stats, setStats] = useState<TecnicoAlertasSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlertas = useCallback(async (tecnicoId: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/hub-usuarios/${tecnicoId}/alertas`);
      if (!res.ok) throw new Error('Erro ao carregar alertas');
      const data = await res.json();
      setAlertas(data.alertas);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  return { alertas, stats, loading, error, fetchAlertas };
}
