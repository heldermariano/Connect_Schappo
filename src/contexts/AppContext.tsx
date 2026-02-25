'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface AppContextValue {
  operatorStatus: string;
  setOperatorStatus: (status: string) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const AppContext = createContext<AppContextValue>({
  operatorStatus: 'disponivel',
  setOperatorStatus: () => {},
  theme: 'light',
  setTheme: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [operatorStatus, setOperatorStatus] = useState('disponivel');
  const [theme, setThemeState] = useState<Theme>('light');

  // Ler tema do localStorage no mount
  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') {
      setThemeState(stored);
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  return (
    <AppContext.Provider value={{ operatorStatus, setOperatorStatus, theme, setTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
