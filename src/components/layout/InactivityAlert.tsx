'use client';

import { useState, useEffect } from 'react';
import Logo from '@/components/Logo';

interface InactivityAlertProps {
  pendingCount: number;
  minutesInactive: number;
  channelToOpen: string;
  onConfirm: () => void;
}

function formatTimer(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function InactivityAlert({ pendingCount, minutesInactive, channelToOpen, onConfirm }: InactivityAlertProps) {
  const [elapsed, setElapsed] = useState(minutesInactive * 60);

  useEffect(() => {
    setElapsed(minutesInactive * 60);
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [minutesInactive]);

  return (
    <div className="fixed inset-0 z-[10000] bg-red-600 flex flex-col items-center justify-center">
      <Logo variant="light" size="lg" />

      <div className="mt-8 text-white/90 text-xl font-medium tracking-wide">
        Inatividade Detectada
      </div>

      <div className="mt-4 text-white text-5xl font-mono font-light tabular-nums">
        {formatTimer(elapsed)}
      </div>

      <div className="mt-6 flex items-center gap-3 bg-white/15 rounded-xl px-6 py-4">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <div className="text-white">
          <div className="text-3xl font-bold">{pendingCount}</div>
          <div className="text-sm text-white/80">
            {pendingCount === 1 ? 'mensagem pendente' : 'mensagens pendentes'}
          </div>
        </div>
      </div>

      <button
        onClick={onConfirm}
        className="mt-10 px-8 py-3 bg-white text-red-600 font-semibold rounded-xl shadow-lg hover:bg-white/90 transition-colors text-lg"
      >
        Confirmar e Atender
      </button>

      <p className="mt-4 text-white/60 text-sm">
        Canal: {channelToOpen || 'geral'}
      </p>
    </div>
  );
}
