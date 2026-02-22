import AppShell from '@/components/layout/AppShell';

// Forcar renderizacao dinamica para evitar HTML estatico desatualizado apos deploy
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
