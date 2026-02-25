'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import SearchBar from '@/components/filters/SearchBar';
import { StatusPresenca } from '@/components/ui/StatusBadge';
import StatusSelector from '@/components/ui/StatusSelector';
import Avatar from '@/components/ui/Avatar';
import { Contato, WHATSAPP_CHANNELS, GRUPO_CHANNELS } from '@/lib/types';
import { useAppContext } from '@/contexts/AppContext';

interface HeaderProps {
  busca: string;
  onBuscaChange: (value: string) => void;
  presenca?: StatusPresenca;
  onPresencaChange?: (status: StatusPresenca) => void;
}

function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const num = phone.replace(/\D/g, '');
  if (num.length === 13 && num.startsWith('55')) {
    return `(${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
  }
  if (num.length === 12 && num.startsWith('55')) {
    return `(${num.slice(2, 4)}) ${num.slice(4, 8)}-${num.slice(8)}`;
  }
  return phone;
}

export default function Header({ busca, onBuscaChange, presenca: presencaProp, onPresencaChange }: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useAppContext();
  const [presencaLocal, setPresencaLocal] = useState<StatusPresenca>('disponivel');
  const presenca = presencaProp ?? presencaLocal;

  // Busca de contatos
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [buscaContatos, setBuscaContatos] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [criandoConversa, setCriandoConversa] = useState<string | null>(null);
  // Seletor de canal ao criar conversa nova
  const [channelSelectContato, setChannelSelectContato] = useState<Contato | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Canais visíveis para este operador
  const userGrupo = (session?.user as { grupo?: string })?.grupo || 'todos';
  const allowedChannelIds = GRUPO_CHANNELS[userGrupo] || GRUPO_CHANNELS.todos;
  const visibleChannels = WHATSAPP_CHANNELS.filter((ch) => allowedChannelIds.includes(ch.id));

  // Buscar contatos quando busca muda
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!busca || busca.trim().length < 2) {
      setContatos([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setBuscaContatos(true);
      try {
        const res = await fetch(`/api/contatos?busca=${encodeURIComponent(busca.trim())}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setContatos(data.contatos || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Erro ao buscar contatos:', err);
      } finally {
        setBuscaContatos(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busca]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleStatusChange = useCallback(async (newStatus: StatusPresenca) => {
    setPresencaLocal(newStatus);
    onPresencaChange?.(newStatus);
    try {
      await fetch('/api/atendentes/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  }, [onPresencaChange]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/atendentes/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'offline' }),
      });
    } catch {
      // Ignorar erro no logout
    }
    signOut({ callbackUrl: '/login' });
  }, []);

  const handleContatoClick = useCallback((contato: Contato) => {
    if (contato.conversa_id) {
      setShowDropdown(false);
      onBuscaChange('');
      // Redirecionar para o canal correto
      const canal = contato.categoria || '';
      router.push(`/conversas?canal=${canal}&id=${contato.conversa_id}`);
      return;
    }

    // Sem conversa: mostrar seletor de canal
    if (!contato.telefone) return;
    setChannelSelectContato(contato);
  }, [router, onBuscaChange]);

  const handleChannelSelect = useCallback(async (contato: Contato, categoria: string) => {
    setChannelSelectContato(null);
    setCriandoConversa(contato.telefone);
    try {
      const res = await fetch('/api/conversas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: contato.telefone, nome: contato.nome, categoria }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowDropdown(false);
        onBuscaChange('');
        router.push(`/conversas?canal=${categoria}&id=${data.conversa.id}`);
      }
    } catch (err) {
      console.error('Erro ao criar conversa:', err);
    } finally {
      setCriandoConversa(null);
    }
  }, [router, onBuscaChange]);

  const user = session?.user;

  return (
    <header className="h-14 bg-schappo-500 flex items-center px-4 gap-3 shrink-0 shadow-sm">
      <Logo variant="orange" size="md" />
      <div className="relative w-80" ref={dropdownRef}>
        <SearchBar value={busca} onChange={onBuscaChange} />

        {/* Dropdown de resultados de contatos */}
        {showDropdown && busca.trim().length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 max-w-md bg-white dark:bg-black rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            {buscaContatos && contatos.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400 text-center">Buscando...</div>
            )}
            {!buscaContatos && contatos.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400 text-center">Nenhum contato encontrado</div>
            )}
            {contatos.length > 0 && (
              <>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Contatos</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {contatos.map((contato, idx) => (
                    <button
                      key={`${contato.telefone}-${idx}`}
                      onClick={() => handleContatoClick(contato)}
                      disabled={criandoConversa === contato.telefone}
                      className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-b-0 disabled:opacity-50"
                    >
                      <Avatar nome={contato.nome} avatarUrl={contato.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{contato.nome}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{formatPhone(contato.telefone)}</div>
                      </div>
                      {contato.conversa_id ? (
                        <span className="text-xs text-schappo-600 font-medium shrink-0">Abrir</span>
                      ) : criandoConversa === contato.telefone ? (
                        <span className="text-xs text-gray-400 font-medium shrink-0">Criando...</span>
                      ) : channelSelectContato?.telefone === contato.telefone ? (
                        <div className="flex items-center gap-1 shrink-0">
                          {visibleChannels.map((ch) => (
                            <button
                              key={ch.id}
                              onClick={(e) => { e.stopPropagation(); handleChannelSelect(contato, ch.id); }}
                              className="px-2 py-1 text-[10px] font-semibold rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200"
                            >
                              {ch.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-green-600 font-medium shrink-0 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Conversar
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Icones inline: status + dark mode + logout (logo apos a busca) */}
      {user && (
        <div className="flex items-center gap-1.5">
          <StatusSelector currentStatus={presenca} onStatusChange={handleStatusChange} />

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
          >
            {theme === 'dark' ? (
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-red-400 hover:bg-white/10 transition-colors"
            title="Sair"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      )}
    </header>
  );
}
