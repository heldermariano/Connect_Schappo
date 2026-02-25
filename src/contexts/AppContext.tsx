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
  chatInternoUnread: number;
  refreshChatInternoUnread: () => void;
}

const AppContext = createContext<AppContextValue>({
  operatorStatus: 'disponivel',
  setOperatorStatus: () => {},
  theme: 'light',
  setTheme: () => {},
  unreadCounts: {},
  refreshUnreadCounts: () => {},
  chatInternoUnread: 0,
  refreshChatInternoUnread: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [operatorStatus, setOperatorStatus] = useState('disponivel');
  const [theme, setThemeState] = useState<Theme>('light');
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [chatInternoUnread, setChatInternoUnread] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ciDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchChatInternoUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/chat-interno/unread-count');
      if (res.ok) {
        const data = await res.json();
        setChatInternoUnread(data.count || 0);
      }
    } catch {
      // Falha silenciosa
    }
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
    fetchChatInternoUnread();
  }, [fetchUnreadCounts, fetchChatInternoUnread]);

  // Refresh debounced (chamado pelo SSE)
  const refreshUnreadCounts = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUnreadCounts();
    }, 500);
  }, [fetchUnreadCounts]);

  // Refresh debounced chat interno (chamado pelo SSE)
  const refreshChatInternoUnread = useCallback(() => {
    if (ciDebounceRef.current) clearTimeout(ciDebounceRef.current);
    ciDebounceRef.current = setTimeout(() => {
      fetchChatInternoUnread();
    }, 500);
  }, [fetchChatInternoUnread]);

  return (
    <AppContext.Provider value={{ operatorStatus, setOperatorStatus, theme, setTheme, unreadCounts, refreshUnreadCounts, chatInternoUnread, refreshChatInternoUnread }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
