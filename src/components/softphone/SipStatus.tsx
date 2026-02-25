'use client';

import type { SipRegistrationState } from '@/lib/types';

interface SipStatusProps {
  state: SipRegistrationState;
  error: string | null;
  inline?: boolean;
}

const STATUS_CONFIG: Record<SipRegistrationState, { color: string; bg: string; label: string }> = {
  registered: { color: 'bg-green-500', bg: 'bg-green-50', label: 'Registrado' },
  registering: { color: 'bg-yellow-500', bg: 'bg-yellow-50', label: 'Registrando...' },
  error: { color: 'bg-red-500', bg: 'bg-red-50', label: 'Erro' },
  unregistered: { color: 'bg-gray-400', bg: 'bg-gray-50', label: 'Offline' },
};

export default function SipStatus({ state, error, inline }: SipStatusProps) {
  const config = STATUS_CONFIG[state];

  if (inline) {
    return (
      <span className="flex items-center gap-1 ml-1">
        <span className={`w-2 h-2 rounded-full ${config.color} ${state === 'registering' ? 'animate-pulse' : ''}`} />
        <span className="text-[10px] font-medium text-white/60">{config.label}</span>
      </span>
    );
  }

  return (
    <div className={`px-3 py-2 ${config.bg} border-b border-gray-200`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${config.color} ${state === 'registering' ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-medium text-gray-700">{config.label}</span>
      </div>
      {error && state === 'error' && (
        <p className="text-[10px] text-red-500 mt-1 truncate" title={error}>{error}</p>
      )}
    </div>
  );
}
