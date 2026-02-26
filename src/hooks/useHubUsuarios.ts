'use client';

import { useState, useEffect, useCallback } from 'react';
import { HubUsuario } from '@/lib/types';

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
  const [usuarios, setUsuarios] = useState<HubUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hub-usuarios');
      if (!res.ok) throw new Error('Erro ao carregar tecnicos');
      const data = await res.json();
      setUsuarios(data.usuarios);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

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
    await fetchUsuarios();
  }, [fetchUsuarios]);

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
    await fetchUsuarios();
  }, [fetchUsuarios]);

  const deleteUsuario = useCallback(async (id: number) => {
    const res = await fetch(`/api/hub-usuarios/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao excluir tecnico');
    }
    await fetchUsuarios();
  }, [fetchUsuarios]);

  return {
    usuarios,
    loading,
    error,
    refresh: fetchUsuarios,
    addUsuario,
    updateUsuario,
    deleteUsuario,
  };
}
