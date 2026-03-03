'use client';

import { useState, useCallback } from 'react';
import { MedicoAgenda, AgendamentoPaciente, DisparoResult } from '@/lib/types';

interface UseAgendaResult {
  medicos: MedicoAgenda[];
  agendamentos: AgendamentoPaciente[];
  medicoInfo: { nom_medico: string; nom_guerra: string | null; template_whatsapp: string | null } | null;
  loading: boolean;
  loadingMedicos: boolean;
  error: string | null;
  fetchMedicos: () => Promise<void>;
  fetchAgendamentos: (medicoId: number, data: string) => Promise<void>;
  enviarConfirmacao: (chaves: number[], mensagem: string, medicoId: number, data: string) => Promise<DisparoResult>;
  atualizarStatus: (chave: number, status: string) => Promise<void>;
}

export function useAgenda(): UseAgendaResult {
  const [medicos, setMedicos] = useState<MedicoAgenda[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoPaciente[]>([]);
  const [medicoInfo, setMedicoInfo] = useState<{ nom_medico: string; nom_guerra: string | null; template_whatsapp: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMedicos, setLoadingMedicos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMedicos = useCallback(async () => {
    try {
      setLoadingMedicos(true);
      const res = await fetch('/api/agenda/medicos');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ao carregar medicos (${res.status})`);
      }
      const data = await res.json();
      setMedicos(data.medicos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoadingMedicos(false);
    }
  }, []);

  const fetchAgendamentos = useCallback(async (medicoId: number, data: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/agenda/agendamentos?medico=${medicoId}&data=${data}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ao carregar agendamentos (${res.status})`);
      }
      const result = await res.json();
      setAgendamentos(result.agendamentos);
      setMedicoInfo(result.medico || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const enviarConfirmacao = useCallback(async (chaves: number[], mensagem: string, medicoId: number, data: string): Promise<DisparoResult> => {
    const res = await fetch('/api/agenda/disparo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chaves, mensagem, medico_id: medicoId, data }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Erro ao enviar confirmacao');
    }
    const result = await res.json();
    return result;
  }, []);

  const atualizarStatus = useCallback(async (chave: number, status: string) => {
    const res = await fetch(`/api/agenda/${chave}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Erro ao atualizar status');
    }
  }, []);

  return {
    medicos,
    agendamentos,
    medicoInfo,
    loading,
    loadingMedicos,
    error,
    fetchMedicos,
    fetchAgendamentos,
    enviarConfirmacao,
    atualizarStatus,
  };
}
