'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const NAV_ITEMS = [
  { href: '/conversas', label: 'Conversas', icon: 'chat' },
  { href: '/chamadas', label: 'Chamadas', icon: 'phone' },
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
  return (
    <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function SidebarLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#F58220" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="16"
        fontWeight="700"
        fill="white"
      >
        CS
      </text>
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userName = (session?.user as { nome?: string })?.nome;
  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside className="w-16 bg-schappo-black flex flex-col items-center py-4 gap-2 shrink-0">
      <div className="mb-4">
        <SidebarLogo />
      </div>
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
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
