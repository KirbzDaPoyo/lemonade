import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { errorMonitoring } from '../observability/error-monitoring';
import { defaultPreferences, LibraryPreferences, parseLibraryPreferences } from './library-view';

export function useLibraryPreferences(userId: string | null | undefined) {
  const [preferences, setPreferences] = useState<LibraryPreferences>(defaultPreferences);
  const revision = useRef(0);
  const writes = useRef(Promise.resolve());
  const key = userId ? `project-lemonade.library.${Array.from(userId).map(c => c.codePointAt(0)!.toString(16)).join('-')}` : null;
  useEffect(() => {
    let active = true;
    const started = ++revision.current;
    setPreferences(defaultPreferences);
    if (key) {
      void (async () => {
        try {
          const raw = Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
          if (active && revision.current === started) setPreferences(parseLibraryPreferences(raw));
        } catch {
          errorMonitoring.captureException(new Error('Local preference read failed'), { operation: 'preference_read', category: 'storage' });
        }
      })();
    }
    return () => { active = false; };
  }, [key]);
  const update = (next: LibraryPreferences) => {
    revision.current++;
    setPreferences(next);
    if (!key) return;
    const raw = JSON.stringify({ sort: next.sort, density: next.density });
    writes.current = writes.current.then(async () => {
      try {
        if (Platform.OS === 'web') globalThis.localStorage.setItem(key, raw);
        else await SecureStore.setItemAsync(key, raw);
      } catch {
        errorMonitoring.captureException(new Error('Local preference write failed'), { operation: 'preference_write', category: 'storage' });
      }
    });
  };
  return [preferences, update] as const;
}
