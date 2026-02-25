'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Contato, WHATSAPP_CHANNELS, GRUPO_CHANNELS } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

interface ContatoDetailModalProps {
  contato: Contato | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ContatoDetailModal({ contato, open, onClose, onSaved }: ContatoDetailModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [criandoConversa, setCriandoConversa] = useState(false);
  const [showChannelPicker, setShowChannelPicker] = useState(false);

  useEffect(() => {
    if (contato) {
      setNome(contato.nome || '');
      setEmail(contato.email || '');
      setNotas(contato.notas || '');
      setError(null);
      setSuccess(false);
      setShowChannelPicker(false);
    }
  }, [contato]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showChannelPicker) {
          setShowChannelPicker(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose, showChannelPicker]);

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

  // Canais disponiveis para o operador
  const grupo = (session?.user as { grupo?: string })?.grupo || 'todos';
  const allowedChannelIds = GRUPO_CHANNELS[grupo] || GRUPO_CHANNELS.todos;
  const availableChannels = WHATSAPP_CHANNELS.filter((ch) => allowedChannelIds.includes(ch.id));

  const criarConversaNoCanal = useCallback(async (categoria: string) => {
    if (!contato?.telefone) return;
    setCriandoConversa(true);
    setShowChannelPicker(false);
    try {
      const res = await fetch('/api/conversas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: contato.telefone, nome: contato.nome, categoria }),
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

  const handleEnviarMensagem = useCallback(async () => {
    if (!contato?.telefone) return;

    // Se operador so tem 1 canal disponivel, ir direto
    if (availableChannels.length <= 1) {
      if (contato.conversa_id) {
        onClose();
        router.push(`/conversas?id=${contato.conversa_id}`);
      } else {
        criarConversaNoCanal(availableChannels[0]?.id || 'geral');
      }
      return;
    }

    // Mostrar seletor de canal
    setShowChannelPicker(true);
  }, [contato, router, onClose, availableChannels, criarConversaNoCanal]);

  if (!open || !contato) return null;

  const formatPhone = (phone: string) => {
    if (phone.length === 13) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-black rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
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
            {showChannelPicker ? (
              /* Seletor de canal */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Escolha o canal:</span>
                  <button
                    onClick={() => setShowChannelPicker(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
                {availableChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => criarConversaNoCanal(channel.id)}
                    disabled={criandoConversa}
                    className="w-full px-4 py-2.5 text-sm font-medium text-left bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 hover:border-green-300 border border-gray-200 dark:border-gray-600 disabled:opacity-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-green-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.257-.154-2.833.842.842-2.833-.154-.257A8 8 0 1112 20z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{channel.label}</div>
                      <div className="text-xs text-gray-500">{formatPhone(channel.phone)}</div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      channel.provider === 'uazapi'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {channel.provider === 'uazapi' ? 'UAZAPI' : '360Dialog'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
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
            )}
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
