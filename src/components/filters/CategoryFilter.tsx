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
    <div className="flex gap-1 px-3 py-2 border-b border-gray-200">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            selected === f.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
