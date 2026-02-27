'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { WHATSAPP_CHANNELS, GRUPO_CHANNELS } from '@/lib/types';
import { useAppContext } from '@/contexts/AppContext';
import Logo from '@/components/Logo';

const NAV_ITEMS = [
  { href: '/conversas', label: 'Conversas', icon: 'chat' },
  { href: '/chamadas', label: 'Chamadas', icon: 'phone' },
  { href: '/contatos', label: 'Contatos', icon: 'contacts' },
  { href: '/respostas-prontas', label: 'Respostas', icon: 'replies' },
  { href: '/supervisao', label: 'Supervisao', icon: 'supervisao' },
  { href: '/tecnicos', label: 'Tecnicos', icon: 'tecnicos' },
];

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const color = active ? 'text-schappo-500' : 'text-gray-500';
  if (icon === 'chat') {
    return (
      <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (icon === 'replies') {
    return (
      <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }
  if (icon === 'contacts') {
    return (
      <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
  }
  if (icon === 'supervisao') {
    return (
      <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  if (icon === 'tecnicos') {
    return (
      <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    );
  }
  return (
    <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function formatPhone(phone: string): string {
  // 556192894339 → (61) 9289-4339
  const ddd = phone.slice(2, 4);
  const num = phone.slice(4);
  if (num.length === 9) {
    return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
}

function SidebarLogo() {
  return <Logo variant="icon" size="sm" />;
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { unreadCounts } = useAppContext();
  const userName = (session?.user as { nome?: string })?.nome;
  const userRole = (session?.user as { role?: string })?.role;
  const userGrupo = (session?.user as { grupo?: string })?.grupo || 'todos';
  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCanal = searchParams.get('canal');
  const isConversasActive = pathname.startsWith('/conversas');

  // Canais permitidos para este operador
  const allowedChannelIds = GRUPO_CHANNELS[userGrupo] || GRUPO_CHANNELS.todos;
  const visibleChannels = WHATSAPP_CHANNELS.filter((ch) => allowedChannelIds.includes(ch.id));

  // Total de não-lidas (soma dos canais visíveis)
  const totalUnread = visibleChannels.reduce((sum, ch) => sum + (unreadCounts[ch.id] || 0), 0);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setFlyoutOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setFlyoutOpen(false);
    }, 150);
  }, []);

  return (
    <aside className="w-16 bg-schappo-black flex flex-col items-center py-4 gap-2 shrink-0">
      <div className="mb-4">
        <SidebarLogo />
      </div>
      {NAV_ITEMS.filter((item) => {
        // Admin ve tudo
        if (userRole === 'admin') return true;
        // Supervisor ve apenas: conversas, contatos, tecnicos
        if (userRole === 'supervisor') {
          return ['chat', 'contacts', 'tecnicos'].includes(item.icon);
        }
        // Atendentes nao veem tecnicos nem supervisao
        return item.icon !== 'tecnicos' && item.icon !== 'supervisao';
      }).map((item) => {
        const active = pathname.startsWith(item.href);
        const isConversas = item.icon === 'chat';

        if (isConversas) {
          return (
            <div
              key={item.href}
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <Link
                href="/conversas"
                title={item.label}
                className={`w-12 h-12 flex items-center justify-center rounded-xl transition-colors relative ${
                  active
                    ? 'bg-schappo-500/15'
                    : 'hover:bg-white/5'
                }`}
              >
                <NavIcon icon={item.icon} active={active} />
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </Link>

              {/* Flyout submenu — apenas canais */}
              {flyoutOpen && (
                <>
                  {/* Ponte invisivel entre sidebar e flyout */}
                  <div className="absolute left-full top-0 w-2 h-full" />
                  <div className="absolute left-[calc(100%+8px)] top-0 z-50 bg-gray-900 rounded-lg shadow-xl border border-gray-700 py-2 min-w-[200px]">
                    {visibleChannels.map((channel) => {
                      const isActive = activeCanal === channel.id;
                      const channelUnread = unreadCounts[channel.id] || 0;
                      return (
                        <Link
                          key={channel.id}
                          href={`/conversas?canal=${channel.id}`}
                          onClick={() => setFlyoutOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            isActive
                              ? 'text-schappo-400 bg-schappo-500/10'
                              : 'text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <WhatsAppIcon className={`w-4 h-4 ${isActive ? 'text-green-400' : 'text-green-600'}`} />
                          <div className="flex flex-col flex-1">
                            <span className="font-medium">{channel.label}</span>
                            <span className="text-[11px] text-gray-500">{formatPhone(channel.phone)}</span>
                          </div>
                          {channelUnread > 0 && (
                            <span className="min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                              {channelUnread > 99 ? '99+' : channelUnread}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`w-12 h-12 flex items-center justify-center rounded-xl transition-colors ${
              active
                ? 'bg-schappo-500/15'
                : 'hover:bg-white/5'
            }`}
          >
            <NavIcon icon={item.icon} active={active} />
          </Link>
        );
      })}

      {/* Spacer + botão de logout no rodapé */}
      <div className="mt-auto flex flex-col items-center gap-2 pb-2">
        <div
          title={userName || 'Usuário'}
          className="w-9 h-9 rounded-full bg-schappo-500/30 flex items-center justify-center text-xs font-bold text-white"
        >
          {initials}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title="Sair"
          className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
