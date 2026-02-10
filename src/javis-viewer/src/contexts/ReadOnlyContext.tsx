'use client';

import { createContext, useContext, ReactNode } from 'react';

const ReadOnlyContext = createContext(false);

export function ReadOnlyProvider({ children }: { children: ReactNode }) {
  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY?.toLowerCase() === 'true';
  return (
    <ReadOnlyContext.Provider value={isReadOnly}>
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useReadOnly() {
  return useContext(ReadOnlyContext);
}
