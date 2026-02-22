'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextValue {
  operatorStatus: string;
  setOperatorStatus: (status: string) => void;
}

const AppContext = createContext<AppContextValue>({
  operatorStatus: 'disponivel',
  setOperatorStatus: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [operatorStatus, setOperatorStatus] = useState('disponivel');

  return (
    <AppContext.Provider value={{ operatorStatus, setOperatorStatus }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
