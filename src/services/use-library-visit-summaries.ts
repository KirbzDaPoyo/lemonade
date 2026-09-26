import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useVisits } from '../store/visits-context';
import { errorMonitoring } from '../observability/error-monitoring';
import type { VisitSummary } from '../types/visit';

// Only the ordinary library calls this hook. No notes or provider requests.
export function useLibraryVisitSummaries(placeIds: readonly string[], enabled: boolean) {
  const session = useVisits();
  const key = JSON.stringify([...new Set(placeIds)].sort());
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ session: typeof session; key: string; data?: Record<string, VisitSummary>; error?: string } | null>(null);
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    let active = true;
    setResult(null);
    void session.summaries(JSON.parse(key)).then(data => {
      if (active && session.active) setResult({ session, key, data });
    }).catch(() => {
      if (active && session.active) {
        setResult({ session, key, error: 'Visit details could not be loaded. Retry to sort your library.' });
        errorMonitoring.captureException(new Error('Visit summary load failed'), { operation: 'visit_storage', category: 'storage' });
      }
    });
    return () => { active = false; setResult(null); };
  }, [session, key, enabled, attempt]));
  const current = enabled && session.active && result?.session === session && result.key === key ? result : null;
  return { data: current?.data, error: current?.error, loading: enabled && !current,
    retry: () => setAttempt(value => value + 1) };
}
