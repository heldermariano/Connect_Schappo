'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useHubUsuarios } from '@/hooks/useHubUsuarios';
import { HubUsuario } from '@/lib/types';
import TecnicoModal from '@/components/tecnicos/TecnicoModal';
import AlertaHistoricoModal from '@/components/tecnicos/AlertaHistoricoModal';

export default function TecnicosPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const { usuarios, loading, error, addUsuario, updateUsuario, deleteUsuario } = useHubUsuarios();

  if (role && role !== 'admin' && role !== 'supervisor') {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-black">
        <p className="text-gray-400 text-sm">Acesso restrito a administradores e supervisores</p>
      </div>
    );
  }
  const [showModal, setShowModal] = useState(false);
  const [editingTecnico, setEditingTecnico] = useState<HubUsuario | null>(null);
  const [busca, setBusca] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingAlertas, setViewingAlertas] = useState<HubUsuario | null>(null);

  const filtered = usuarios.filter((u) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return u.nome.toLowerCase().includes(q) || u.telefone.includes(q) || (u.setor || '').toLowerCase().includes(q);
  });

  // Totais do dia
  const totais = useMemo(() => {
    let exames = 0, alertas = 0, pendentes = 0;
    for (const u of usuarios) {
      if (u.resumo) {
        exames += u.resumo.exames_hoje;
        alertas += u.resumo.alertas_hoje;
        pendentes += u.resumo.pendentes;
      }
    }
    return { exames, alertas, pendentes };
  }, [usuarios]);

  const handleSave = async (nome: string, telefone: string, cargo: string, setor: string) => {
    if (editingTecnico) {
      await updateUsuario(editingTecnico.id, nome, telefone, cargo, setor);
    } else {
      await addUsuario(nome, telefone, cargo, setor);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteUsuario(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (tecnico: HubUsuario) => {
    setEditingTecnico(tecnico);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingTecnico(null);
    setShowModal(true);
  };

  const getTipoLabel = (setor: string | null) => {
    if (setor && setor.toLowerCase().includes('plantonista')) {
      return { label: 'Plantonista', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    }
    return { label: 'Rotineiro', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Tecnicos EEG
              {!loading && <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">({usuarios.length})</span>}
            </h1>
            {!loading && (totais.exames > 0 || totais.alertas > 0) && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>Hoje:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{totais.exames} exames</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{totais.alertas} alertas</span>
                {totais.pendentes > 0 && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="font-medium text-red-500">{totais.pendentes} pendentes</span>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleNew}
            className="px-3 py-1.5 text-xs font-medium text-white bg-schappo-500 rounded-lg hover:bg-schappo-600 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Tecnico
          </button>
        </div>
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou setor..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <svg className="w-6 h-6 animate-spin text-schappo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        {error && (
          <div className="text-center py-8 text-red-500 text-sm">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              {busca ? 'Nenhum tecnico encontrado' : 'Nenhum tecnico cadastrado ainda'}
            </p>
            {!busca && (
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Cadastre tecnicos para receber alertas de fichas incompletas
              </p>
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((u) => {
            const tipo = getTipoLabel(u.setor);
            const resumo = u.resumo;
            const hasPendentes = (resumo?.pendentes ?? 0) > 0;
            return (
              <div
                key={u.id}
                className={`border rounded-lg p-4 transition-colors relative ${
                  hasPendentes
                    ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {/* Alerta pulsante no canto */}
                {hasPendentes && (
                  <div className="absolute top-3 right-3" title={`${resumo!.pendentes} fichas pendentes`}>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                  </div>
                )}

                {/* Nome e tipo */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{u.nome}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${tipo.className}`}>
                    {tipo.label}
                  </span>
                </div>

                {/* Info */}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span>{u.telefone}</span>
                  <span>{u.cargo}</span>
                </div>

                {/* Mini-cards de metricas */}
                {resumo && (
                  <div className="flex items-stretch gap-2 mb-3">
                    <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded-md px-2 py-1.5 text-center">
                      <div className="text-sm font-semibold text-blue-700 dark:text-blue-400">{resumo.exames_hoje}</div>
                      <div className="text-[10px] text-blue-500 dark:text-blue-500">exames</div>
                    </div>
                    <div className="flex-1 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2 py-1.5 text-center">
                      <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">{resumo.alertas_hoje}</div>
                      <div className="text-[10px] text-amber-500 dark:text-amber-500">alertas</div>
                    </div>
                    <div className={`flex-1 rounded-md px-2 py-1.5 text-center ${
                      resumo.pendentes > 0
                        ? 'bg-red-50 dark:bg-red-950/30'
                        : 'bg-green-50 dark:bg-green-950/30'
                    }`}>
                      <div className={`text-sm font-semibold ${
                        resumo.pendentes > 0
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-green-700 dark:text-green-400'
                      }`}>{resumo.pendentes}</div>
                      <div className={`text-[10px] ${
                        resumo.pendentes > 0
                          ? 'text-red-500 dark:text-red-500'
                          : 'text-green-500 dark:text-green-500'
                      }`}>pendentes</div>
                    </div>
                  </div>
                )}

                {/* Botoes de acao */}
                <div className="flex items-center justify-end gap-1 border-t border-gray-100 dark:border-gray-800 pt-2">
                  <button
                    onClick={() => setViewingAlertas(u)}
                    className="p-1.5 text-gray-400 hover:text-amber-500 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    title="Historico de alertas"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleEdit(u)}
                    className="p-1.5 text-gray-400 hover:text-schappo-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    disabled={deletingId === u.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    title="Excluir"
                  >
                    {deletingId === u.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <TecnicoModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingTecnico(null); }}
        onSave={handleSave}
        tecnico={editingTecnico}
      />
      {viewingAlertas && (
        <AlertaHistoricoModal
          open={true}
          onClose={() => setViewingAlertas(null)}
          tecnico={viewingAlertas}
        />
      )}
    </div>
  );
}
