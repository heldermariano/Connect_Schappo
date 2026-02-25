'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

type Theme = 'light' | 'dark';

export type UnreadCounts = Record<string, number>;

interface AppContextValue {
  operatorStatus: string;
  setOperatorStatus: (status: string) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  unreadCounts: UnreadCounts;
  refreshUnreadCounts: () => void;
}

const AppContext = createContext<AppContextValue>({
  operatorStatus: 'disponivel',
  setOperatorStatus: () => {},
  theme: 'light',
  setTheme: () => {},
  unreadCounts: {},
  refreshUnreadCounts: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [operatorStatus, setOperatorStatus] = useState('disponivel');
  const [theme, setThemeState] = useState<Theme>('light');
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/conversas/unread-counts');
      if (res.ok) {
        const data = await res.json();
        setUnreadCounts(data.counts || {});
      }
    } catch {
      // Falha silenciosa
    }
  }, []);

  // Fetch inicial
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Refresh debounced (chamado pelo SSE)
  const refreshUnreadCounts = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUnreadCounts();
    }, 500);
  }, [fetchUnreadCounts]);

  return (
    <AppContext.Provider value={{ operatorStatus, setOperatorStatus, theme, setTheme, unreadCounts, refreshUnreadCounts }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
