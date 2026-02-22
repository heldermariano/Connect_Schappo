'use client';

import { Contato } from '@/lib/types';
import ContatoItem from './ContatoItem';

interface ContatoListProps {
  contatos: Contato[];
  loading: boolean;
  onSelect: (contato: Contato) => void;
}

export default function ContatoList({ contatos, loading, onSelect }: ContatoListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (contatos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4 text-center">
        Nenhum contato encontrado
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {contatos.map((contato, idx) => (
        <ContatoItem
          key={`${contato.telefone}-${idx}`}
          contato={contato}
          onClick={() => onSelect(contato)}
        />
      ))}
    </div>
  );
}
