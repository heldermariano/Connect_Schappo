'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/conversas', label: 'Conversas', icon: 'chat' },
  { href: '/chamadas', label: 'Chamadas', icon: 'phone' },
];

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const color = active ? 'text-blue-600' : 'text-gray-500';
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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 bg-gray-900 flex flex-col items-center py-4 gap-2 shrink-0">
      <div className="mb-4 text-white font-bold text-xs">CS</div>
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`w-12 h-12 flex items-center justify-center rounded-xl transition-colors ${
              active ? 'bg-gray-700' : 'hover:bg-gray-800'
            }`}
          >
            <NavIcon icon={item.icon} active={active} />
          </Link>
        );
      })}
    </aside>
  );
}
