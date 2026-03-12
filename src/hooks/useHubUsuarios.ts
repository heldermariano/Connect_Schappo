'use client';

import { useCallback } from 'react';
import { HubUsuario } from '@/lib/types';
import { useFetchList } from './useFetchList';

interface UseHubUsuariosResult {
  usuarios: HubUsuario[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  addUsuario: (nome: string, telefone: string, cargo: string, setor: string) => Promise<void>;
  updateUsuario: (id: number, nome: string, telefone: string, cargo: string, setor: string) => Promise<void>;
  deleteUsuario: (id: number) => Promise<void>;
}

export function useHubUsuarios(): UseHubUsuariosResult {
  const { items, loading, error, refresh } = useFetchList<HubUsuario>({
    url: '/api/hub-usuarios',
    dataKey: 'usuarios',
  });

  const addUsuario = useCallback(async (nome: string, telefone: string, cargo: string, setor: string) => {
    const res = await fetch('/api/hub-usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone, cargo, setor }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao criar tecnico');
    }
    await refresh();
  }, [refresh]);

  const updateUsuario = useCallback(async (id: number, nome: string, telefone: string, cargo: string, setor: string) => {
    const res = await fetch(`/api/hub-usuarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone, cargo, setor }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao atualizar tecnico');
    }
    await refresh();
  }, [refresh]);

  const deleteUsuario = useCallback(async (id: number) => {
    const res = await fetch(`/api/hub-usuarios/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao excluir tecnico');
    }
    await refresh();
  }, [refresh]);

  return {
    usuarios: items,
    loading,
    error,
    refresh,
    addUsuario,
    updateUsuario,
    deleteUsuario,
  };
}
