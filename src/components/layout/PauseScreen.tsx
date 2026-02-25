'use client';

import { useState, useEffect } from 'react';
import Logo from '@/components/Logo';

interface PauseScreenProps {
  status: 'pausa' | 'ausente';
  onResume: () => void;
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

export default function PauseScreen({ status, onResume }: PauseScreenProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const label = status === 'pausa' ? 'Em Pausa' : 'Ausente';

  return (
    <div className="fixed inset-0 z-[9999] bg-[#F58220] flex flex-col items-center justify-center">
      <Logo variant="light" size="lg" />

      <div className="mt-10 text-white/90 text-xl font-medium tracking-wide">
        {label}
      </div>

      <div className="mt-4 text-white text-5xl font-mono font-light tabular-nums">
        {formatTimer(elapsed)}
      </div>

      <button
        onClick={onResume}
        className="mt-10 px-8 py-3 bg-white text-[#F58220] font-semibold rounded-xl shadow-lg hover:bg-white/90 transition-colors text-lg"
      >
        Voltar
      </button>
    </div>
  );
}
