'use client';

import { useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/layout/Sidebar';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { useSSE } from '@/hooks/useSSE';
import { requestNotificationPermission } from '@/lib/desktop-notification';

// Importar Softphone dinamicamente sem SSR (sip.js usa APIs do browser)
const Softphone = dynamic(() => import('@/components/softphone/Softphone'), {
  ssr: false,
  loading: () => (
    <div className="w-72 shrink-0 border-l border-gray-200 bg-white flex flex-col">
      <div className="h-14 flex items-center justify-center border-b border-gray-200 bg-gray-900">
        <span className="text-sm font-semibold text-white/50">Telefone</span>
      </div>
    </div>
  ),
});

function ShellInner({ children }: { children: React.ReactNode }) {
  const { operatorStatus, refreshUnreadCounts } = useAppContext();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // SSE global para atualizar badges de não-lidas
  const handleGlobalSSE = useCallback(
    (event: string) => {
      if (event === 'nova_mensagem' || event === 'conversa_atualizada') {
        refreshUnreadCounts();
      }
    },
    [refreshUnreadCounts],
  );

  useSSE(handleGlobalSSE);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
      <Softphone operatorStatus={operatorStatus} />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <ShellInner>{children}</ShellInner>
    </AppProvider>
  );
}
