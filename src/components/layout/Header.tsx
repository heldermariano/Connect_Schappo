'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Logo from '@/components/Logo';
import SearchBar from '@/components/filters/SearchBar';
import StatusBadge, { StatusPresenca } from '@/components/ui/StatusBadge';
import StatusSelector from '@/components/ui/StatusSelector';

interface HeaderProps {
  busca: string;
  onBuscaChange: (value: string) => void;
}

export default function Header({ busca, onBuscaChange }: HeaderProps) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [presenca, setPresenca] = useState<StatusPresenca>('disponivel');
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleStatusChange = useCallback(async (newStatus: StatusPresenca) => {
    setPresenca(newStatus);
    try {
      await fetch('/api/atendentes/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    // Atualizar status para offline antes de sair
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

  const user = session?.user;
  const initials = user?.nome
    ? user.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <header className="h-14 bg-schappo-500 flex items-center px-4 gap-4 shrink-0 shadow-sm">
      <Logo variant="light" size="sm" />
      <div className="flex-1">
        <SearchBar value={busca} onChange={onBuscaChange} />
      </div>

      {/* User menu */}
      {user && (
        <div className="flex items-center gap-3">
          {/* Status selector */}
          <StatusSelector currentStatus={presenca} onStatusChange={handleStatusChange} />

          {/* User dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1.5 transition-colors"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white">
                  {initials}
                </div>
                {/* Badge de status sobre o avatar */}
                <span className="absolute -bottom-0.5 -right-0.5">
                  <StatusBadge status={presenca} size="sm" />
                </span>
              </div>
              <span className="text-sm text-white font-medium hidden sm:block">{user.nome}</span>
              <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {/* Info do usuario */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-900">{user.nome}</div>
                  <div className="text-xs text-gray-500">
                    {user.role === 'admin' ? 'Administrador' : 'Atendente'} &middot; {user.grupo.toUpperCase()}
                  </div>
                  {user.ramal && (
                    <div className="text-xs text-gray-400 mt-0.5">Ramal {user.ramal}</div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusBadge status={presenca} size="sm" showLabel />
                  </div>
                </div>

                {/* Sair */}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
