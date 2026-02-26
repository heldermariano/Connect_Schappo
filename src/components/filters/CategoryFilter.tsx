'use client';

import { useState, useRef, useEffect } from 'react';
import { WHATSAPP_CHANNELS } from '@/lib/types';

interface CategoryFilterProps {
  selected: string;
  onChange: (value: string) => void;
  grupo?: string;
  canal?: string | null;
  busca?: string;
  onBuscaChange?: (value: string) => void;
  onListarGrupos?: () => void;
}

const ALL_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'individual', label: 'Individual' },
  { value: 'grupo-eeg', label: 'Grp EEG' },
  { value: 'grupo-recepcao', label: 'Grp Recep' },
];

// Filtros permitidos por grupo de atendimento (modo sem canal)
const GRUPO_FILTERS: Record<string, string[]> = {
  recepcao: ['', 'individual', 'grupo-recepcao'],
  eeg: ['', 'individual', 'grupo-eeg'],
  todos: ['', 'individual', 'grupo-eeg', 'grupo-recepcao'],
};

export default function CategoryFilter({
  selected,
  onChange,
  grupo = 'todos',
  canal,
  busca = '',
  onBuscaChange,
  onListarGrupos,
}: CategoryFilterProps) {
  const [pendentesAtivo, setPendentesAtivo] = useState(false);
  const prevFilterRef = useRef(selected);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quando pendentes desativa, voltar ao filtro anterior
  useEffect(() => {
    if (selected !== 'pendentes') {
      prevFilterRef.current = selected;
    }
  }, [selected]);

  // Com canal selecionado: novo layout (2 tabs + busca + icones)
  if (canal) {
    const channelInfo = WHATSAPP_CHANNELS.find((ch) => ch.id === canal);
    const is360 = channelInfo?.provider === '360dialog';
    const isGrupoTab = selected === 'grupo';

    const tabs = is360
      ? [{ value: 'individual', label: 'Individual' }]
      : [
          { value: 'individual', label: 'Individual' },
          { value: 'grupo', label: 'Grupo' },
        ];

    const handleTogglePendentes = () => {
      if (pendentesAtivo) {
        // Desativar: voltar ao filtro anterior
        setPendentesAtivo(false);
        onChange(prevFilterRef.current || 'individual');
      } else {
        // Ativar pendentes
        setPendentesAtivo(true);
        onChange('pendentes');
      }
    };

    const handleTabChange = (value: string) => {
      setPendentesAtivo(false);
      onChange(value);
    };

    return (
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
        {/* Linha 1: Tabs */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1">
          {tabs.map((t) => {
            const isActive = !pendentesAtivo && selected === t.value;
            return (
              <button
                key={t.value}
                onClick={() => handleTabChange(t.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-schappo-50 dark:bg-schappo-500/15 text-schappo-700 dark:text-schappo-400 border border-schappo-200 dark:border-schappo-500/30'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'
                }`}
              >
                {t.label}
                {isActive && (
                  <span className="block h-0.5 mt-1 bg-schappo-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Linha 2: Busca + Icones */}
        <div className="flex items-center gap-1.5 px-3 pb-2">
          {/* Campo de busca */}
          <div className="flex-1 relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={(e) => onBuscaChange?.(e.target.value)}
              placeholder="Nome, numero ou mensagem..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-schappo-500 focus:border-schappo-500 transition-colors"
            />
            {busca && (
              <button
                onClick={() => onBuscaChange?.('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Icone Pendentes (sino) */}
          <button
            onClick={handleTogglePendentes}
            title={pendentesAtivo ? 'Desativar filtro pendentes' : 'Filtrar pendentes'}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
              pendentesAtivo
                ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-500/40'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </button>

          {/* Icone Listar Grupos (so quando tab=grupo e nao 360dialog) */}
          {isGrupoTab && !is360 && onListarGrupos && (
            <button
              onClick={onListarGrupos}
              title="Listar todos os grupos do canal"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Sem canal: comportamento original (filtros por grupo)
  const allowedValues = GRUPO_FILTERS[grupo] || GRUPO_FILTERS.todos;
  const filters = ALL_FILTERS.filter((f) => allowedValues.includes(f.value));

  return (
    <div className="flex justify-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            selected === f.value
              ? 'bg-schappo-50 dark:bg-schappo-500/15 text-schappo-700 dark:text-schappo-400 border border-schappo-200 dark:border-schappo-500/30'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'
          }`}
        >
          {f.label}
          {selected === f.value && (
            <span className="block h-0.5 mt-1 bg-schappo-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
