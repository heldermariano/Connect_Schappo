'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAppContext } from '@/contexts/AppContext';
import { WHATSAPP_CHANNELS, GRUPO_CHANNELS } from '@/lib/types';

interface BottomNavProps {
  onOpenSoftphone?: () => void;
  onOpenChatInterno?: () => void;
}

const PRIMARY_ITEMS = [
  { href: '/conversas', label: 'Conversas', icon: 'chat' },
  { href: '/chamadas', label: 'Chamadas', icon: 'phone' },
  { href: '/contatos', label: 'Contatos', icon: 'contacts' },
  { href: '/confirmacao', label: 'Confirmar', icon: 'confirmacao' },
];

const MORE_ITEMS = [
  { href: '/respostas-prontas', label: 'Respostas Prontas', icon: 'replies' },
  { href: '/supervisao', label: 'Supervisao', icon: 'supervisao' },
  { href: '/tecnicos', label: 'Tecnicos', icon: 'tecnicos' },
  // TODO: reativar quando chat interno e softphone estiverem estáveis
  // { href: '/chat-interno', label: 'Chat Interno', icon: 'chat-interno' },
];

function NavIcon({ icon, size = 'w-5 h-5' }: { icon: string; size?: string }) {
  if (icon === 'chat') {
    return (
      <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (icon === 'phone') {
    return (
      <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    );
  }
  if (icon === 'contacts') {
    return (
      <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
  }
  if (icon === 'confirmacao') {
    return (
      <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2 2 4-4" />
      </svg>
    );
  }
  if (icon === 'replies') {
    return (
      <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }
  if (icon === 'supervisao') {
    return (
      <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  if (icon === 'tecnicos') {
    return (
      <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    );
  }
  if (icon === 'chat-interno') {
    return (
      <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-1m0-3V6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2h-4l-4 4V10H7a2 2 0 01-2-2z" />
      </svg>
    );
  }
  // more (ellipsis)
  return (
    <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  );
}

export default function BottomNav({ onOpenSoftphone, onOpenChatInterno }: BottomNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { unreadCounts, chatInternoUnread } = useAppContext();
  const [moreOpen, setMoreOpen] = useState(false);

  const userRole = (session?.user as { role?: string })?.role;
  const userGrupo = (session?.user as { grupo?: string })?.grupo || 'todos';

  // Canais visiveis
  const allowedChannelIds = GRUPO_CHANNELS[userGrupo] || GRUPO_CHANNELS.todos;
  const visibleChannels = WHATSAPP_CHANNELS.filter((ch) => allowedChannelIds.includes(ch.id));
  const totalUnread = visibleChannels.reduce((sum, ch) => sum + (unreadCounts[ch.id] || 0), 0);

  // Filtrar items por role
  const filterByRole = (icon: string) => {
    if (userRole === 'admin') return true;
    if (userRole === 'supervisor') {
      return ['chat', 'contacts', 'tecnicos'].includes(icon);
    }
    return icon !== 'tecnicos' && icon !== 'supervisao';
  };

  const primaryFiltered = PRIMARY_ITEMS.filter((i) => filterByRole(i.icon));
  const moreFiltered = MORE_ITEMS.filter((i) => filterByRole(i.icon));

  return (
    <>
      {/* Overlay para fechar "Mais" */}
      {moreOpen && (
        <div className="fixed inset-0 z-[9989]" onClick={() => setMoreOpen(false)} />
      )}

      {/* Bottom sheet "Mais" */}
      {moreOpen && (
        <div className="fixed bottom-[calc(var(--bottom-nav-height)+var(--safe-area-bottom))] left-0 right-0 z-[9990] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 rounded-t-2xl shadow-xl">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-2" />
            <span className="text-xs font-semibold text-gray-500 uppercase">Mais opcoes</span>
          </div>
          <div className="py-2">
            {moreFiltered.map((item) => {
              const active = pathname.startsWith(item.href);
              if (item.icon === 'chat-interno') {
                return (
                  <button
                    key={item.icon}
                    onClick={() => { setMoreOpen(false); onOpenChatInterno?.(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <NavIcon icon={item.icon} />
                    <span>{item.label}</span>
                    {chatInternoUnread > 0 && (
                      <span className="ml-auto min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {chatInternoUnread > 99 ? '99+' : chatInternoUnread}
                      </span>
                    )}
                  </button>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    active
                      ? 'text-schappo-500 bg-schappo-50 dark:bg-schappo-500/10'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <NavIcon icon={item.icon} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {/* TODO: reativar Softphone quando estiver estável */}
          </div>
        </div>
      )}

      {/* Nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[9988] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800" style={{ paddingBottom: 'var(--safe-area-bottom)' }}>
        <div className="flex items-center justify-around" style={{ height: 'var(--bottom-nav-height)' }}>
          {primaryFiltered.map((item) => {
            const active = pathname.startsWith(item.href);
            const isConversas = item.icon === 'chat';
            // Para conversas, usar primeiro canal disponivel
            const href = isConversas && visibleChannels.length > 0
              ? `/conversas?canal=${visibleChannels[0].id}`
              : item.href;

            return (
              <Link
                key={item.href}
                href={href}
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
                  active ? 'text-schappo-500' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <NavIcon icon={item.icon} />
                <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                {isConversas && totalUnread > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-1.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </Link>
            );
          })}
          {/* Botao "Mais" */}
          {moreFiltered.length > 0 && (
            <button
              onClick={() => setMoreOpen((p) => !p)}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
                moreOpen ? 'text-schappo-500' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <NavIcon icon="more" />
              <span className="text-[10px] mt-0.5 font-medium">Mais</span>
              {chatInternoUnread > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-1.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {chatInternoUnread > 99 ? '99+' : chatInternoUnread}
                </span>
              )}
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
