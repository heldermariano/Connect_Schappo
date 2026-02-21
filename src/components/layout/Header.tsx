'use client';

import Logo from '@/components/Logo';
import SearchBar from '@/components/filters/SearchBar';

interface HeaderProps {
  busca: string;
  onBuscaChange: (value: string) => void;
}

export default function Header({ busca, onBuscaChange }: HeaderProps) {
  return (
    <header className="h-14 bg-schappo-500 flex items-center px-4 gap-4 shrink-0 shadow-sm">
      <Logo variant="light" size="sm" />
      <div className="flex-1">
        <SearchBar value={busca} onChange={onBuscaChange} />
      </div>
    </header>
  );
}
