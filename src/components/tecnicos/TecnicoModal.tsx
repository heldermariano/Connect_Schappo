'use client';

import { useState, useEffect } from 'react';
import { HubUsuario } from '@/lib/types';

interface TecnicoModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (nome: string, telefone: string, cargo: string, setor: string) => Promise<void>;
  tecnico?: HubUsuario | null;
}

export default function TecnicoModal({ open, onClose, onSave, tecnico }: TecnicoModalProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cargo, setCargo] = useState('Técnico EEG');
  const [setor, setSetor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!tecnico;

  useEffect(() => {
    if (open) {
      setNome(tecnico?.nome || '');
      setTelefone(tecnico?.telefone || '');
      setCargo(tecnico?.cargo || 'Técnico EEG');
      setSetor(tecnico?.setor || '');
      setError(null);
    }
  }, [open, tecnico]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) {
      setError('Nome e telefone sao obrigatorios');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await onSave(nome.trim(), telefone.trim(), cargo.trim(), setor.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-black rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {isEditing ? 'Editar Tecnico' : 'Novo Tecnico'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo do tecnico"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone</label>
            <input
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="5561999999999"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Formato: DDI + DDD + numero (ex: 5561999999999)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cargo</label>
            <input
              type="text"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Tecnico EEG"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Setor</label>
            <select
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
            >
              <option value="">Selecione...</option>
              <option value="Rotineiro">Rotineiro</option>
              <option value="Plantonista (Plantonista)">Plantonista</option>
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Define o tipo de alerta enviado ao tecnico</p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-schappo-500 rounded-lg hover:bg-schappo-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
