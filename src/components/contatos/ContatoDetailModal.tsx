'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Contato } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

interface ContatoDetailModalProps {
  contato: Contato | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ContatoDetailModal({ contato, open, onClose, onSaved }: ContatoDetailModalProps) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [criandoConversa, setCriandoConversa] = useState(false);

  useEffect(() => {
    if (contato) {
      setNome(contato.nome || '');
      setEmail(contato.email || '');
      setNotas(contato.notas || '');
      setError(null);
      setSuccess(false);
    }
  }, [contato]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  const handleSave = useCallback(async () => {
    if (!contato?.telefone || !nome.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/contatos/${encodeURIComponent(contato.telefone)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), email: email.trim(), notas: notas.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      setSuccess(true);
      onSaved?.();
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar contato');
    } finally {
      setSaving(false);
    }
  }, [contato, nome, email, notas, onSaved]);

  const handleEnviarMensagem = useCallback(async () => {
    if (!contato?.telefone) return;

    if (contato.conversa_id) {
      onClose();
      router.push(`/conversas?id=${contato.conversa_id}`);
      return;
    }

    // Criar conversa nova
    setCriandoConversa(true);
    try {
      const res = await fetch('/api/conversas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: contato.telefone, nome: contato.nome }),
      });
      if (res.ok) {
        const data = await res.json();
        onClose();
        router.push(`/conversas?id=${data.conversa.id}`);
      } else {
        setError('Erro ao criar conversa');
      }
    } catch (err) {
      console.error('Erro ao criar conversa:', err);
      setError('Erro ao criar conversa');
    } finally {
      setCriandoConversa(false);
    }
  }, [contato, router, onClose]);

  if (!open || !contato) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-schappo-500 px-6 py-4 flex items-center gap-4">
          <Avatar nome={contato.nome} avatarUrl={contato.avatar_url} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold truncate">{contato.nome}</div>
            <div className="text-white/70 text-sm">{contato.telefone || 'Sem telefone'}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Botao Enviar Mensagem — principal */}
        {contato.telefone && (
          <div className="px-6 pt-4">
            <button
              onClick={handleEnviarMensagem}
              disabled={criandoConversa}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {criandoConversa ? 'Abrindo...' : 'Enviar Mensagem'}
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Telefone (readonly) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Telefone</label>
            <input
              type="text"
              value={contato.telefone || ''}
              readOnly
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            />
          </div>

          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
              placeholder="Nome do contato"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
              placeholder="email@exemplo.com"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent resize-none"
              placeholder="Observacoes sobre o contato..."
            />
          </div>

          {/* Mensagens de feedback */}
          {error && (
            <div className="px-3 py-2 bg-red-50 text-red-600 text-xs rounded-lg">{error}</div>
          )}
          {success && (
            <div className="px-3 py-2 bg-green-50 text-green-600 text-xs rounded-lg">Salvo com sucesso!</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !nome.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-schappo-500 rounded-lg hover:bg-schappo-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
