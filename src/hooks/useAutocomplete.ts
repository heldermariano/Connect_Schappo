import { useState, useEffect, useCallback } from 'react';

interface UseAutocompleteOptions {
  trigger: string;            // '#', '@', '/'
  query: string | null;       // current query (null = inactive)
  onClose: () => void;        // close the popup
  itemCount: number;          // number of items in the list
  onSelect: (index: number) => void;  // select item at index
}

interface UseAutocompleteReturn {
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
}

export function useAutocomplete({
  query,
  onClose,
  itemCount,
  onSelect,
}: UseAutocompleteOptions): UseAutocompleteReturn {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset index quando query muda
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard handler com capture: true (captura antes do textarea)
  useEffect(() => {
    if (query === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(itemCount, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + itemCount) % Math.max(itemCount, 1));
      } else if (e.key === 'Enter' && itemCount > 0) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(selectedIndex);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [query, itemCount, selectedIndex, onSelect, onClose]);

  return { selectedIndex, setSelectedIndex };
}
