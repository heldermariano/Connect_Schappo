'use client';

import { WHATSAPP_CHANNELS } from '@/lib/types';

interface CategoryFilterProps {
  selected: string;
  onChange: (value: string) => void;
  grupo?: string;
  canal?: string | null;
}

const ALL_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'individual', label: 'Individual' },
  { value: 'grupo-eeg', label: 'Grp EEG' },
  { value: 'grupo-recepcao', label: 'Grp Recep' },
];

const CHANNEL_FILTERS_UAZAPI = [
  { value: 'individual', label: 'Individual' },
  { value: 'grupo', label: 'Grupo' },
];

const CHANNEL_FILTERS_360 = [
  { value: 'individual', label: 'Individual' },
];

// Filtros permitidos por grupo de atendimento (modo sem canal)
const GRUPO_FILTERS: Record<string, string[]> = {
  recepcao: ['', 'individual', 'grupo-recepcao'],
  eeg: ['', 'individual', 'grupo-eeg'],
  todos: ['', 'individual', 'grupo-eeg', 'grupo-recepcao'],
};

export default function CategoryFilter({ selected, onChange, grupo = 'todos', canal }: CategoryFilterProps) {
  // Com canal selecionado: apenas botões Individual/Grupo (sem badge)
  if (canal) {
    const channelInfo = WHATSAPP_CHANNELS.find((ch) => ch.id === canal);
    const is360 = channelInfo?.provider === '360dialog';
    const filters = is360 ? CHANNEL_FILTERS_360 : CHANNEL_FILTERS_UAZAPI;

    return (
      <div className="flex justify-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              selected === f.value
                ? 'bg-schappo-50 text-schappo-700 border border-schappo-200'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
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

  // Sem canal: comportamento original
  const allowedValues = GRUPO_FILTERS[grupo] || GRUPO_FILTERS.todos;
  const filters = ALL_FILTERS.filter((f) => allowedValues.includes(f.value));

  return (
    <div className="flex justify-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            selected === f.value
              ? 'bg-schappo-50 text-schappo-700 border border-schappo-200'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
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
