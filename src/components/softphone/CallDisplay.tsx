'use client';

import type { SipCallState } from '@/lib/types';

interface CallDisplayProps {
  callState: SipCallState;
  number: string;
  duration: number;
  contactName?: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const STATE_LABELS: Record<SipCallState, string> = {
  idle: '',
  calling: 'Chamando...',
  ringing: 'Recebendo chamada...',
  'in-call': 'Em chamada',
  'on-hold': 'Em espera',
};

export default function CallDisplay({ callState, number, duration, contactName }: CallDisplayProps) {
  if (callState === 'idle') return null;

  return (
    <div className="px-3 py-3 bg-gray-800 text-white text-center">
      <p className="text-[11px] text-gray-400 uppercase tracking-wide">
        {STATE_LABELS[callState]}
      </p>
      <p className="text-lg font-semibold mt-1 font-mono">
        {contactName || number || 'Desconhecido'}
      </p>
      {contactName && number && (
        <p className="text-xs text-gray-400">{number}</p>
      )}
      {(callState === 'in-call' || callState === 'on-hold') && (
        <p className="text-sm text-gray-300 mt-1 font-mono">{formatDuration(duration)}</p>
      )}
    </div>
  );
}
