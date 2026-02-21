'use client';

import SearchBar from '@/components/filters/SearchBar';

interface HeaderProps {
  busca: string;
  onBuscaChange: (value: string) => void;
}

export default function Header({ busca, onBuscaChange }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
      <h1 className="text-lg font-semibold text-gray-900 whitespace-nowrap">Connect Schappo</h1>
      <SearchBar value={busca} onChange={onBuscaChange} />
    </header>
  );
}
