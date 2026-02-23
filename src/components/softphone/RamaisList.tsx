'use client';

import { useState, useEffect, useCallback } from 'react';

interface Ramal {
  ramal: string;
  status: 'online' | 'offline';
}

interface RamaisListProps {
  onDial: (ramal: string) => void;
  disabled: boolean;
}

export default function RamaisList({ onDial, disabled }: RamaisListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [ramais, setRamais] = useState<Ramal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRamais = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ramais');
      if (res.ok) {
        const data: Ramal[] = await res.json();
        setRamais(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualizar ao abrir e periodicamente
  useEffect(() => {
    if (!isOpen) return;
    fetchRamais();
    const timer = setInterval(fetchRamais, 15000);
    return () => clearInterval(timer);
  }, [isOpen, fetchRamais]);

  return (
    <div className="border-t border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Ramais Online
          {ramais.length > 0 && (
            <span className="bg-green-100 text-green-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
              {ramais.length}
            </span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-3 pb-2">
          {loading && ramais.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-2">Carregando...</p>
          ) : ramais.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-2">Nenhum ramal online</p>
          ) : (
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {ramais.map((r) => (
                <div
                  key={r.ramal}
                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs font-mono text-gray-700">{r.ramal}</span>
                  </div>
                  <button
                    onClick={() => onDial(r.ramal)}
                    disabled={disabled}
                    className="hidden group-hover:flex items-center gap-1 text-[10px] text-green-600 hover:text-green-700 disabled:opacity-50 px-1.5 py-0.5 rounded bg-green-50 hover:bg-green-100 transition-colors"
                    title={`Ligar para ramal ${r.ramal}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Ligar
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={fetchRamais}
            disabled={loading}
            className="w-full mt-1 text-[10px] text-gray-400 hover:text-gray-600 py-1 transition-colors disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      )}
    </div>
  );
}
