import { createClient } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { backendConfig } from '../config/backend';
import { createSupabaseFetchWithJwtClockSkewRetry, type SupabaseAccessTokenProvider } from '../lib/supabaseClient';
import { VisitsRepository } from '../repositories/visits/visits-repository';
import { VisitAccountSession } from '../services/visit-journal';

const Context = createContext<VisitAccountSession | null>(null);
export function VisitsProvider({ userId, accessTokenProvider, children }: {
  userId: string; accessTokenProvider: SupabaseAccessTokenProvider; children: ReactNode;
}) {
  const tokenRef = useRef(accessTokenProvider);
  tokenRef.current = accessTokenProvider;
  const accountRef = useRef(userId);
  accountRef.current = userId;
  const session = useMemo(() => {
    let scope: VisitAccountSession;
    const token: SupabaseAccessTokenProvider = async options => {
      if (!scope.active || accountRef.current !== userId) throw new Error('Account changed');
      const generation = scope.generation;
      const value = await tokenRef.current(options);
      if (!scope.active || generation !== scope.generation || accountRef.current !== userId) throw new Error('Account changed');
      if (!value) throw new Error('Authentication required');
      const payload = JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.sub !== userId) throw new Error('Account changed');
      return value;
    };
    const client = backendConfig.supabaseUrl && backendConfig.supabasePublishableKey
      ? createClient(backendConfig.supabaseUrl, backendConfig.supabasePublishableKey, {
        accessToken: token, global: { fetch: createSupabaseFetchWithJwtClockSkewRetry(fetch, ms => new Promise(resolve => setTimeout(resolve, ms)), token) },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      }) : undefined;
    scope = new VisitAccountSession(client ? new VisitsRepository(client, userId) : undefined);
    return scope;
  }, [userId]);
  useEffect(() => { session.active = true; return () => session.clear(); }, [session]);
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function useVisits() {
  const session = useContext(Context);
  if (!session) throw new Error('VisitsProvider required');
  return session;
}
