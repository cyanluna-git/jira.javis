'use client';

import { createContext, useContext, ReactNode } from 'react';
import type { AccessContext } from '@/lib/access';

const defaultAccessContext: AccessContext = {
  mode: 'legacy',
  isAuthenticated: false,
  hasRefreshSession: false,
  user: null,
  capabilities: {
    generalWrite: false,
    jiraWrite: false,
    confluenceWrite: false,
  },
  reasons: {
    general: 'authentication_required',
    jira: 'authentication_required',
    confluence: 'authentication_required',
  },
  isReadOnly: true,
};

const ReadOnlyContext = createContext<AccessContext>(defaultAccessContext);

export function ReadOnlyProvider({
  children,
  initialAccess,
}: {
  children: ReactNode;
  initialAccess: AccessContext;
}) {
  return (
    <ReadOnlyContext.Provider value={initialAccess}>
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useReadOnly() {
  return useContext(ReadOnlyContext).isReadOnly;
}

export function useAccessContext() {
  return useContext(ReadOnlyContext);
}
