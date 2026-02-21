'use client';

interface CategoryFilterProps {
  selected: string;
  onChange: (value: string) => void;
}

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'individual', label: 'Individual' },
  { value: 'grupo-eeg', label: 'Grp EEG' },
  { value: 'grupo-recepcao', label: 'Grp Recep' },
];

export default function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-1 px-3 py-2 border-b border-gray-200 bg-white">
      {FILTERS.map((f) => (
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
