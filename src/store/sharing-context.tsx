import { createClient } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { backendConfig } from '../config/backend';
import { createSupabaseFetchWithJwtClockSkewRetry, type SupabaseAccessTokenProvider } from '../lib/supabaseClient';
import { SharingFailure, SharingSession, sharingOrigin } from '../services/owner-sharing';
const Context = createContext<SharingSession | null>(null);
export function SharingProvider({ userId, accessTokenProvider, children }: {
  userId: string; accessTokenProvider: SupabaseAccessTokenProvider; children: ReactNode;
}) {
  const tokenRef = useRef(accessTokenProvider); tokenRef.current = accessTokenProvider;
  const accountRef = useRef(userId); accountRef.current = userId;
  const session = useMemo(() => {
    let scope: SharingSession;
    const token: SupabaseAccessTokenProvider = async options => {
      const current = scope.guard(); current();
      if (accountRef.current !== userId) throw new SharingFailure('account');
      const value = await tokenRef.current(options); current();
      if (!value) throw new SharingFailure('authentication');
      const payload = JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (accountRef.current !== userId || payload.sub !== userId) throw new SharingFailure('account');
      return value;
    };
    const client = backendConfig.supabaseUrl && backendConfig.supabasePublishableKey
      ? createClient(backendConfig.supabaseUrl, backendConfig.supabasePublishableKey, {
        accessToken: token,
        global: { fetch: createSupabaseFetchWithJwtClockSkewRetry(fetch, ms => new Promise(resolve => setTimeout(resolve, ms)), token) },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      }) : undefined;
    scope = new SharingSession(client ? {
      metadata: async (name, args) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const { data, error } = await client.rpc(name, args).abortSignal(controller.signal);
          if (error) throw new SharingFailure();
          return data;
        } finally { clearTimeout(timeout); }
      },
      owner: async body => {
        const current = scope.guard();
        const accessToken = await token(); current();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(`${backendConfig.supabaseUrl}/functions/v1/plan-sharing`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`,
              apikey: backendConfig.supabasePublishableKey! }, body: JSON.stringify(body), signal: controller.signal
          });
          current();
          if (!response.ok) throw new SharingFailure(response.status === 409 ? 'conflict' : response.status === 422 ? 'ineligible'
            : response.status === 429 ? 'limited' : response.status === 401 ? 'authentication' : response.status === 400 ? 'invalid' : 'unavailable');
          return await response.json();
        } finally { clearTimeout(timeout); }
      }
    } : undefined, sharingOrigin(process.env.EXPO_PUBLIC_SHARING_ORIGIN));
    return scope;
  }, [userId]);
  useEffect(() => { session.active = true; return () => session.clear(); }, [session]);
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function useSharing() {
  const session = useContext(Context);
  if (!session) throw new Error('SharingProvider required');
  return session;
}
