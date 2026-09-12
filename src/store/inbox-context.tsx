import { createClient } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { backendConfig } from '../config/backend';
import type { SupabaseAccessTokenProvider } from '../lib/supabaseClient';
import { InboxRepository } from '../repositories/inbox/inbox-repository';
import { errorMonitoring } from '../observability/error-monitoring';
import { analytics } from '../observability/analytics';
import type { AnalyticsFailureCategory } from '../observability/analytics-contract';
import { extractInboxLinks } from '../services/incomingShare/inbox-links';
import type { CaptureSummary, InboxItem, InboxOrigin } from '../types/inbox';

export function useInboxState(repository: InboxRepository | undefined) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const alive = useRef(true);
  const revision = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; revision.current++; }; }, []);
  const storage = useCallback(() => {
    if (!repository || !alive.current) throw new Error('Inbox storage unavailable. Sign in and retry.');
    return repository;
  }, [repository]);
  const failed = useCallback(() => {
    if (alive.current) setError('Inbox storage unavailable. Your pending items remain safe; refresh or retry.');
    errorMonitoring.captureException(new Error('Inbox operation failed'), { operation: 'inbox_storage', category: 'storage' });
  }, []);
  const refresh = useCallback(async () => {
    if (!alive.current) return null;
    const request = ++revision.current;
    setLoading(true);
    try {
      const rows = await storage().list();
      if (alive.current && request === revision.current) { setItems(rows); setError(undefined); }
      return rows;
    } catch { failed(); return null; }
    finally { if (alive.current && request === revision.current) setLoading(false); }
  }, [failed, storage]);
  useEffect(() => { void refresh(); }, [refresh]);
  const enqueue = useCallback(async (text: string, origin: InboxOrigin) => {
    const parsed = extractInboxLinks(text);
    try {
      const results = await storage().enqueue(parsed.urls, origin);
      const summary: CaptureSummary = { queued: 0, already_queued: 0, already_saved: 0, invalid: parsed.invalid, capacity_reached: 0, duplicate: parsed.duplicate, omitted: parsed.omitted, submitted: parsed.urls.length };
      for (const result of results) summary[result.outcome]++;
      analytics.inboxEnqueued(origin, summary);
      await refresh(); // Capture success must survive a separate hydration failure.
      return { results, summary };
    } catch { failed(); throw new Error('Could not add to inbox. Retry when connected.'); }
  }, [failed, refresh, storage]);
  const mutate = useCallback(async (action: (repo: InboxRepository) => Promise<void>) => {
    try { await action(storage()); await refresh(); return true; }
    catch { failed(); return false; }
  }, [failed, refresh, storage]);
  const remove = useCallback(async (id: string, resolved = false) => {
    try {
      await storage().remove(id);
      revision.current++;
      if (alive.current) { setItems(current => current.filter(item => item.id !== id)); setLoading(false); setError(undefined); }
      if (resolved) analytics.inboxResolved(); else analytics.inboxDismissed();
      return true;
    } catch { failed(); return false; }
  }, [failed, storage]);
  const clear = useCallback(async () => {
    try {
      await storage().clear();
      revision.current++;
      if (alive.current) { setItems([]); setLoading(false); setError(undefined); }
      analytics.inboxCleared();
      return true;
    } catch { failed(); return false; }
  }, [failed, storage]);
  const updateHint = useCallback((id: string, hint: string) => mutate(repo => repo.updateHint(id, hint)), [mutate]);
  const beginAttempt = useCallback(async (id: string, hint: string) => {
    const ok = await mutate(repo => repo.beginAttempt(id, hint));
    if (ok) analytics.inboxProcessingStarted();
    return ok;
  }, [mutate]);
  const markAttention = useCallback((id: string, category: AnalyticsFailureCategory) => mutate(repo => repo.markAttention(id, category)), [mutate]);
  const findSaved = useCallback((url: string) => storage().findSaved(url), [storage]);
  const exportItems = useCallback(() => storage().list(), [storage]);
  const clearLocalData = useCallback(() => { revision.current++; setItems([]); setError(undefined); }, []);
  return { items, loading, error, refresh, enqueue, remove, clear, updateHint, beginAttempt, markAttention, findSaved, exportItems, clearLocalData };
}
const InboxContext = createContext<ReturnType<typeof useInboxState> | null>(null);
export function InboxProvider({ userId, accessTokenProvider, children }: { userId: string; accessTokenProvider: SupabaseAccessTokenProvider; children: ReactNode }) {
  // Clerk Expo creates a new token wrapper on each auth render.
  // Preserve repository identity while reading the latest token getter.
  const tokenProviderRef = useRef(accessTokenProvider);
  tokenProviderRef.current = accessTokenProvider;
  const repository = useMemo(() => {
    if (!backendConfig.supabaseUrl || !backendConfig.supabasePublishableKey) return undefined;
    // A dedicated client prevents the saved-place singleton's changing token
    // provider from moving an in-flight capture into another account.
    const client = createClient(backendConfig.supabaseUrl, backendConfig.supabasePublishableKey, {
      accessToken: async () => {
        const token = await tokenProviderRef.current();
        if (!token) throw new Error('Authentication required');
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.sub !== userId) throw new Error('Account changed');
        return token;
      },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    return new InboxRepository(client, userId);
  }, [userId]);
  const state = useInboxState(repository);
  return <InboxContext.Provider value={state}>{children}</InboxContext.Provider>;
}
export function useInbox() {
  const value = useContext(InboxContext);
  if (!value) throw new Error('InboxProvider is required');
  return value;
}
