'use client';

import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';

interface UseFetchListOptions {
  url: string;
  params?: Record<string, string | undefined>;
  dataKey: string;
  totalKey?: string;
}

interface UseFetchListResult<T> {
  items: T[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setItems: Dispatch<SetStateAction<T[]>>;
}

export function useFetchList<T>(options: UseFetchListOptions): UseFetchListResult<T> {
  const { url, params, dataKey, totalKey } = options;
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialize params for dependency tracking
  const paramsKey = params ? Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).sort().join('&') : '';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v) query.set(k, v);
        }
      }
      const qs = query.toString();
      const res = await fetch(qs ? `${url}?${qs}` : url);
      if (!res.ok) throw new Error(`Erro ao carregar dados (${res.status})`);

      const data = await res.json();
      setItems(data[dataKey] ?? []);
      setTotal(totalKey ? (data[totalKey] ?? 0) : 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, dataKey, totalKey, paramsKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { items, total, loading, error, refresh: fetchData, setItems };
}
