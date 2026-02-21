'use client';

interface RamalInfo {
  ramal: string;
  status: 'online' | 'offline' | 'busy';
}

interface RamalStatusProps {
  ramais: RamalInfo[];
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  online: { color: 'bg-green-400', label: 'Livre' },
  offline: { color: 'bg-gray-400', label: 'Offline' },
  busy: { color: 'bg-red-400', label: 'Ocupado' },
};

export default function RamalStatus({ ramais }: RamalStatusProps) {
  if (ramais.length === 0) return null;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="text-[11px] font-semibold text-gray-500 uppercase mb-1.5">Ramais</div>
      <div className="flex gap-3 flex-wrap">
        {ramais.map((r) => {
          const config = STATUS_CONFIG[r.status] || STATUS_CONFIG.offline;
          return (
            <div key={r.ramal} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`w-2 h-2 rounded-full ${config.color}`} />
              <span className="font-medium">{r.ramal}</span>
              <span className="text-gray-400">{config.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
