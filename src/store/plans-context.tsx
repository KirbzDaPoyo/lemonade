import { createClient } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { backendConfig } from '../config/backend';
import type { SupabaseAccessTokenProvider } from '../lib/supabaseClient';
import { PlansRepository, PlanStorageError } from '../repositories/plans/plans-repository';
import type { DiningPlan } from '../types/dining-plan';
import { errorMonitoring } from '../observability/error-monitoring';
export function usePlansState(repository: PlansRepository | undefined) {
    const [plans, setPlans] = useState<DiningPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();
    const generation = useRef(0);
    const revision = useRef(0);
    const locked = useRef(false);
    useEffect(() => { generation.current++; setPlans([]); return () => { generation.current++; }; }, [repository]);
    const refresh = useCallback(async () => {
        const g = generation.current;
        const r = ++revision.current;
        setLoading(true);
        try {
            if (!repository)
                throw new Error();
            const data = await repository.list();
            if (g !== generation.current || r !== revision.current)
                return null;
            setPlans(data);
            setError(undefined);
            return data;
        }
        catch {
            if (g === generation.current && r === revision.current)
                setError('Plans could not be refreshed. Check your connection and retry.');
            return null;
        }
        finally {
            if (g === generation.current && r === revision.current)
                setLoading(false);
        }
    }, [repository]);
    useEffect(() => { void refresh(); }, [refresh]);
    const mutate = useCallback(async (action: (repo: PlansRepository) => Promise<void>) => {
        if (locked.current || !repository)
            return false;
        const g = generation.current;
        locked.current = true;
        setBusy(true);
        revision.current++;
        try {
            await action(repository);
            if (g !== generation.current)
                return false;
            await refresh();
            return g === generation.current;
        }
        catch (e) {
            if (g === generation.current) {
                setError(e instanceof PlanStorageError ? e.message : 'Plan could not be saved. Check your connection and retry.');
                errorMonitoring.captureException(new Error('Plan storage operation failed'), { operation: 'plan_storage', category: 'storage' });
            }
            return false;
        }
        finally {
            locked.current = false;
            if (g === generation.current)
                setBusy(false);
        }
    }, [repository, refresh]);
    const exportPlans = useCallback(async () => { const g = generation.current; if (!repository)
        throw new Error('Plans unavailable'); const data = await repository.list(); if (g !== generation.current)
        throw new Error('Account changed'); return data; }, [repository]);
    const clearLocalData = useCallback(() => { revision.current++; generation.current++; setPlans([]); setError(undefined); }, []);
    return { plans, loading, busy, error, refresh, mutate, exportPlans, clearLocalData };
}
const PlansContext = createContext<ReturnType<typeof usePlansState> | null>(null);
export function PlansProvider({ userId, accessTokenProvider, children }: {
    userId: string;
    accessTokenProvider: SupabaseAccessTokenProvider;
    children: ReactNode;
}) {
    const tokenRef = useRef(accessTokenProvider);
    tokenRef.current = accessTokenProvider;
    const repository = useMemo(() => {
        if (!backendConfig.supabaseUrl || !backendConfig.supabasePublishableKey)
            return undefined;
        const client = createClient(backendConfig.supabaseUrl, backendConfig.supabasePublishableKey, { accessToken: async () => {
                const token = await tokenRef.current();
                if (!token)
                    throw new Error('Authentication required');
                const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                if (payload.sub !== userId)
                    throw new Error('Account changed');
                return token;
            }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        return new PlansRepository(client, userId);
    }, [userId]);
    const state = usePlansState(repository);
    return <PlansContext.Provider value={state}>{children}</PlansContext.Provider>;
}
export function usePlans() { const value = useContext(PlansContext); if (!value)
    throw new Error('PlansProvider required'); return value; }
