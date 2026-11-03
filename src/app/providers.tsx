import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { SessionContext } from '@/entities/session';
import { supabase, isConfigured } from '@/shared/api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
export function Providers({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    session: Session | null;
    ready: boolean;
    error: unknown;
  }>({ session: null, ready: !isConfigured, error: null });
  useEffect(() => {
    if (!isConfigured) return;
    let active = true;
    let identity: string | undefined;
    let authEventReceived = false;
    function update(session: Session | null, error: unknown = null) {
      if (!active) return;
      if (identity !== session?.user.id) {
        queryClient.clear();
        identity = session?.user.id;
      }
      setState({ session, ready: true, error });
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      update(session);
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!authEventReceived) update(data.session, error);
      })
      .catch((error: unknown) => update(null, error));
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={state}>
        {children}
      </SessionContext.Provider>
    </QueryClientProvider>
  );
}
