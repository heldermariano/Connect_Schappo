'use client';

export type StatusPresenca = 'disponivel' | 'pausa' | 'almoco' | 'cafe' | 'lanche' | 'offline';

interface StatusBadgeProps {
  status: StatusPresenca;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<StatusPresenca, { color: string; label: string }> = {
  disponivel: { color: 'bg-green-500', label: 'Disponivel' },
  pausa: { color: 'bg-yellow-400', label: 'Pausa' },
  almoco: { color: 'bg-amber-500', label: 'Almoco' },
  cafe: { color: 'bg-amber-500', label: 'Cafe' },
  lanche: { color: 'bg-amber-500', label: 'Lanche' },
  offline: { color: 'bg-gray-400', label: 'Offline' },
};

const SIZE_MAP = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

/** Normaliza status legado (ex: 'ausente' do banco) para o novo tipo */
export function normalizeStatus(status: string): StatusPresenca {
  if (status === 'ausente') return 'almoco';
  if (STATUS_CONFIG[status as StatusPresenca]) return status as StatusPresenca;
  return 'offline';
}

export function getStatusLabel(status: StatusPresenca): string {
  return STATUS_CONFIG[status]?.label || 'Offline';
}

/** Verifica se um status eh um tipo de pausa (pausa, almoco, cafe, lanche) */
export function isPauseStatus(status: string): boolean {
  return ['pausa', 'almoco', 'cafe', 'lanche', 'ausente'].includes(status);
}

export default function StatusBadge({ status, size = 'md', showLabel = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  const sizeClass = SIZE_MAP[size];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`${sizeClass} ${config.color} rounded-full inline-block ring-2 ring-white`} />
      {showLabel && <span className="text-xs text-gray-600">{config.label}</span>}
    </span>
  );
}
