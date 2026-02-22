'use client';

interface CategoryFilterProps {
  selected: string;
  onChange: (value: string) => void;
  grupo?: string;
}

const ALL_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'individual', label: 'Individual' },
  { value: 'grupo-eeg', label: 'Grp EEG' },
  { value: 'grupo-recepcao', label: 'Grp Recep' },
];

// Filtros permitidos por grupo de atendimento
const GRUPO_FILTERS: Record<string, string[]> = {
  recepcao: ['', 'individual', 'grupo-recepcao'],
  eeg: ['', 'individual', 'grupo-eeg'],
  todos: ['', 'individual', 'grupo-eeg', 'grupo-recepcao'],
};

export default function CategoryFilter({ selected, onChange, grupo = 'todos' }: CategoryFilterProps) {
  const allowedValues = GRUPO_FILTERS[grupo] || GRUPO_FILTERS.todos;
  const filters = ALL_FILTERS.filter((f) => allowedValues.includes(f.value));

  return (
    <div className="flex gap-1 px-3 py-2 border-b border-gray-200 bg-white">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            selected === f.value
              ? 'bg-schappo-50 text-schappo-700 border border-schappo-200'
              : 'text-gray-600 hover:bg-gray-100 border border-transparent'
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
