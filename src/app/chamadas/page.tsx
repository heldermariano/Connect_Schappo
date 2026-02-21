'use client';

import { useState, useCallback } from 'react';
import { Chamada } from '@/lib/types';
import Sidebar from '@/components/layout/Sidebar';
import CallLog from '@/components/calls/CallLog';
import CallAlert from '@/components/calls/CallAlert';
import RamalStatus from '@/components/calls/RamalStatus';
import { useSSE } from '@/hooks/useSSE';
import { useChamadas } from '@/hooks/useChamadas';

interface RamalInfo {
  ramal: string;
  status: 'online' | 'offline' | 'busy';
}

export default function ChamadasPage() {
  const [filtroOrigem, setFiltroOrigem] = useState('');
  const [ramais, setRamais] = useState<RamalInfo[]>([
    { ramal: '201', status: 'offline' },
    { ramal: '202', status: 'offline' },
    { ramal: '203', status: 'offline' },
    { ramal: '204', status: 'offline' },
  ]);

  const { chamadas, loading, addChamada, updateChamada, refresh } = useChamadas({
    origem: filtroOrigem || undefined,
  });

  const handleSSE = useCallback(
    (event: string, data: unknown) => {
      if (event === 'chamada_nova') {
        const d = data as { chamada: Chamada };
        addChamada(d.chamada);
      }
      if (event === 'chamada_atualizada') {
        const d = data as { chamada_id: number; status: string; duracao?: number };
        updateChamada(d.chamada_id, {
          status: d.status as Chamada['status'],
          ...(d.duracao !== undefined ? { duracao_seg: d.duracao } : {}),
        });
      }
      if (event === 'ramal_status') {
        const d = data as { ramal: string; status: 'online' | 'offline' | 'busy' };
        setRamais((prev) =>
          prev.map((r) => (r.ramal === d.ramal ? { ...r, status: d.status } : r)),
        );
      }
    },
    [addChamada, updateChamada],
  );

  useSSE(handleSSE);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Chamadas</h1>
          <div className="flex-1" />
          <button
            onClick={refresh}
            className="text-xs text-blue-600 hover:underline"
          >
            Atualizar
          </button>
        </header>

        {/* Alerta de chamadas ativas */}
        <CallAlert chamadas={chamadas} />

        {/* Status dos ramais */}
        <RamalStatus ramais={ramais} />

        {/* Filtros */}
        <div className="flex gap-1 px-4 py-2 border-b border-gray-200 bg-white">
          {[
            { value: '', label: 'Todas' },
            { value: 'telefone', label: 'Telefone' },
            { value: 'whatsapp', label: 'WhatsApp Voz' },
            { value: 'whatsapp-tentativa', label: 'Tentativas' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltroOrigem(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filtroOrigem === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista de chamadas */}
        <CallLog chamadas={chamadas} loading={loading} />
      </div>
    </div>
  );
}
