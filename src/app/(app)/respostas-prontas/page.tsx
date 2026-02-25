'use client';

import { useState } from 'react';
import { useRespostasProntas } from '@/hooks/useRespostasProntas';
import { RespostaPronta } from '@/lib/types';
import RespostaProntaModal from '@/components/respostas-prontas/RespostaProntaModal';

export default function RespostasProntasPage() {
  const { respostas, loading, error, addResposta, updateResposta, deleteResposta } = useRespostasProntas();
  const [showModal, setShowModal] = useState(false);
  const [editingResposta, setEditingResposta] = useState<RespostaPronta | null>(null);
  const [busca, setBusca] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = respostas.filter((r) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return r.atalho.toLowerCase().includes(q) || r.conteudo.toLowerCase().includes(q);
  });

  const handleSave = async (atalho: string, conteudo: string) => {
    if (editingResposta) {
      await updateResposta(editingResposta.id, atalho, conteudo);
    } else {
      await addResposta(atalho, conteudo);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteResposta(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (resposta: RespostaPronta) => {
    setEditingResposta(resposta);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingResposta(null);
    setShowModal(true);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Respostas Prontas
            {!loading && <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">({respostas.length})</span>}
          </h1>
          <button
            onClick={handleNew}
            className="px-3 py-1.5 text-xs font-medium text-white bg-schappo-500 rounded-lg hover:bg-schappo-600 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Resposta
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
            placeholder="Buscar por atalho ou conteudo..."
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              {busca ? 'Nenhuma resposta encontrada' : 'Nenhuma resposta criada ainda'}
            </p>
            {!busca && (
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Crie respostas prontas e use <span className="font-mono text-schappo-500">/atalho</span> no chat
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-schappo-600 dark:text-schappo-400 font-mono">/{r.atalho}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">
                    {r.conteudo}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleEdit(r)}
                    className="p-1.5 text-gray-400 hover:text-schappo-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    title="Excluir"
                  >
                    {deletingId === r.id ? (
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
            </div>
          ))}
        </div>
      </div>

      <RespostaProntaModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingResposta(null); }}
        onSave={handleSave}
        resposta={editingResposta}
      />
    </div>
  );
}
