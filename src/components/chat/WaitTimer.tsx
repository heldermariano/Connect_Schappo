'use client';

import { useState, useEffect } from 'react';

interface WaitTimerProps {
  since: string; // ISO timestamp da ultima mensagem
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  return `${h}h${remMin > 0 ? `${remMin}m` : ''}`;
}

function getTimerColor(ms: number): string {
  const min = ms / 60000;
  if (min < 2) return 'text-green-600 bg-green-50';
  if (min < 5) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

export default function WaitTimer({ since }: WaitTimerProps) {
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(since).getTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - new Date(since).getTime());
    }, 30000);
    return () => clearInterval(interval);
  }, [since]);

  if (elapsed < 0) return null;

  const colorClass = getTimerColor(elapsed);

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded ${colorClass}`}>
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {formatElapsed(elapsed)}
    </span>
  );
}
