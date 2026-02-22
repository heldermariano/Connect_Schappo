'use client';

import Sidebar from '@/components/layout/Sidebar';
import Softphone from '@/components/softphone/Softphone';
import { AppProvider, useAppContext } from '@/contexts/AppContext';

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { operatorStatus } = useAppContext();

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <LayoutInner>{children}</LayoutInner>
    </AppProvider>
  );
}
