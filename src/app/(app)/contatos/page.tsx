'use client';

import { useState } from 'react';
import { useContatos } from '@/hooks/useContatos';
import { Contato } from '@/lib/types';
import ContatoList from '@/components/contatos/ContatoList';
import AddContatoModal from '@/components/contatos/AddContatoModal';
import ImportCsvModal from '@/components/contatos/ImportCsvModal';
import ContatoDetailModal from '@/components/contatos/ContatoDetailModal';

export default function ContatosPage() {
  const { contatos, total, loading, loadingMore, hasMore, loadMore, busca, setBusca, refresh, syncing, syncResult, sync } = useContatos();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedContato, setSelectedContato] = useState<Contato | null>(null);

  const handleSelect = (contato: Contato) => {
    setSelectedContato(contato);
  };

  const handleAdd = async (nome: string, telefone: string, email?: string) => {
    const res = await fetch('/api/contatos/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone, email }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao adicionar');
    }
    refresh();
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-900">
            Contatos
            {!loading && <span className="text-sm font-normal text-gray-400 ml-2">({total})</span>}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Importar CSV
            </button>
            <button
              onClick={sync}
              disabled={syncing}
              className="px-3 py-1.5 text-xs font-medium text-schappo-600 bg-schappo-50 rounded-lg hover:bg-schappo-100 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? 'Sincronizando...' : 'Sincronizar Fotos'}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-schappo-500 rounded-lg hover:bg-schappo-600 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar
            </button>
          </div>
        </div>

        {/* Resultado da sync */}
        {syncResult && (
          <div className="mb-3 px-3 py-2 bg-green-50 text-green-700 text-xs rounded-lg">
            Sincronizados {syncResult.fetched} chats, {syncResult.updated} fotos atualizadas.
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lista */}
      <ContatoList
        contatos={contatos}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onSelect={handleSelect}
      />

      {/* Modais */}
      <AddContatoModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />
      <ImportCsvModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={refresh}
      />
      <ContatoDetailModal
        contato={selectedContato}
        open={!!selectedContato}
        onClose={() => setSelectedContato(null)}
        onSaved={refresh}
      />
    </div>
  );
}
