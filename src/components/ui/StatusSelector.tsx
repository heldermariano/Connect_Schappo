'use client';

import { useState, useRef, useEffect } from 'react';
import { StatusPresenca, getStatusLabel } from './StatusBadge';

interface StatusSelectorProps {
  currentStatus: StatusPresenca;
  onStatusChange: (status: StatusPresenca) => void;
}

const STATUS_OPTIONS: { value: StatusPresenca; icon: string; label: string; color: string }[] = [
  { value: 'disponivel', icon: '\u25CF', label: 'Disponivel', color: 'text-green-500' },
  { value: 'pausa', icon: '\u25CF', label: 'Pausa', color: 'text-yellow-400' },
  { value: 'ausente', icon: '\u25CF', label: 'Ausente', color: 'text-red-500' },
  { value: 'offline', icon: '\u25CF', label: 'Offline', color: 'text-gray-400' },
];

export default function StatusSelector({ currentStatus, onStatusChange }: StatusSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const current = STATUS_OPTIONS.find((o) => o.value === currentStatus) || STATUS_OPTIONS[3];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors"
        title={`Status: ${getStatusLabel(currentStatus)}`}
      >
        <span className={current.color}>{current.icon}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-black rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onStatusChange(option.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                option.value === currentStatus
                  ? 'bg-schappo-50 text-schappo-700 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className={`text-lg leading-none ${option.color}`}>{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
