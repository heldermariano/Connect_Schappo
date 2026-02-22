'use client';

import { useState, useCallback } from 'react';

interface CallButtonProps {
  telefone: string;
  size?: 'sm' | 'md';
  label?: string;
}

export default function CallButton({ telefone, size = 'sm', label }: CallButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCall = useCallback(async () => {
    if (loading || !telefone) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/calls/originate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destino: telefone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao ligar');
        // Limpar erro apos 4 segundos
        setTimeout(() => setError(null), 4000);
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Erro de conexao');
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }, [telefone, loading]);

  const sizeClasses = size === 'md'
    ? 'w-9 h-9 text-base'
    : 'w-7 h-7 text-sm';

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleCall}
        disabled={loading || !telefone}
        title={error || (success ? 'Chamada iniciada!' : `Ligar para ${telefone}`)}
        className={`${sizeClasses} rounded-full flex items-center justify-center transition-all ${
          loading
            ? 'bg-yellow-100 text-yellow-600 cursor-wait'
            : success
            ? 'bg-green-100 text-green-600'
            : error
            ? 'bg-red-100 text-red-600'
            : 'bg-schappo-100 text-schappo-600 hover:bg-schappo-200 active:bg-schappo-300'
        } disabled:opacity-50`}
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : success ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        )}
      </button>
      {label && !error && !success && (
        <span className="ml-1.5 text-xs text-gray-500 hidden sm:inline">{label}</span>
      )}
      {error && (
        <span className="ml-1.5 text-xs text-red-500 max-w-[160px] truncate">{error}</span>
      )}
    </div>
  );
}
