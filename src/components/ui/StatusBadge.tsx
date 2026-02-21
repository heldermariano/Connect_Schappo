'use client';

export type StatusPresenca = 'disponivel' | 'pausa' | 'ausente' | 'offline';

interface StatusBadgeProps {
  status: StatusPresenca;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<StatusPresenca, { color: string; label: string }> = {
  disponivel: { color: 'bg-green-500', label: 'Disponivel' },
  pausa: { color: 'bg-yellow-400', label: 'Pausa' },
  ausente: { color: 'bg-red-500', label: 'Ausente' },
  offline: { color: 'bg-gray-400', label: 'Offline' },
};

const SIZE_MAP = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export function getStatusLabel(status: StatusPresenca): string {
  return STATUS_CONFIG[status]?.label || 'Offline';
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
