import { usePathname, useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { V2Button } from '../components/v2-controls';
import { useAppTheme } from '../design-system/theme';
import { useInbox } from '../store/inbox-context';
import { getIncomingInstagramUrl } from './share-routing';
import { normalizeInstagramSourceUrl } from '../services/incomingShare/instagramUrl';
import { appRoutePaths, getPlaceDetailHref } from './route-contract';

export function AuthenticatedShareCoordinator() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const { theme } = useAppTheme();
  const { enqueue } = useInbox();
  const { error, hasShareIntent, resetShareIntent, shareIntent } = useShareIntentContext();
  const handling = useRef(false);
  const alive = useRef(true);
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const capture = async (url: string) => {
    if (inFlight.current.has(url)) return;
    inFlight.current.add(url);
    setBusy(true);
    try {
      const { results } = await enqueue(url, 'share');
      if (!alive.current) return;
      const result = results[0];
      if (!result || result.outcome === 'invalid' || result.outcome === 'capacity_reached') {
        setNotice(result?.outcome === 'capacity_reached' ? 'Inbox full (100 links). Remove an item, then retry this share.' : 'Could not add this share. Retry or dismiss.');
        return;
      }
      setPending(current => current.filter(value => value !== url));
      setPlaceId(result.placeId);
      setNotice(result.outcome === 'already_saved' ? 'Already saved.' : result.outcome === 'already_queued' ? 'Already in inbox.' : 'Added to inbox. Process it when you choose.');
      const activeImport = ['/add-place', '/match-place'].includes(pathRef.current);
      if (!activeImport && result.outcome === 'queued' && pathRef.current !== '/inbox') router.push(appRoutePaths.inbox);
    } catch {
      if (alive.current) setNotice('Could not add to inbox. The link is retained in this session; retry when connected.');
    } finally {
      inFlight.current.delete(url);
      if (alive.current) setBusy(inFlight.current.size > 0);
    }
  };
  useEffect(() => {
    if (!hasShareIntent) { handling.current = false; return; }
    if (handling.current) return;
    handling.current = true;
    const extracted = getIncomingInstagramUrl(shareIntent.webUrl, shareIntent.text);
    if (!extracted) {
      setNotice('Share a supported public Instagram post or reel URL.');
      resetShareIntent();
      return;
    }
    const url = normalizeInstagramSourceUrl(extracted);
    // Retain the canonical URL before resetting exactly once. Failures never
    // fall back to provider processing or replace an active import draft.
    setPending(current => current.includes(url) ? current : [...current, url]);
    setPlaceId(null);
    resetShareIntent();
    void capture(url);
  }, [hasShareIntent, shareIntent.webUrl, shareIntent.text, resetShareIntent, enqueue]);
  useEffect(() => { if (error) setNotice('Could not receive share. Try sharing a public Instagram link again.'); }, [error]);
  if (!notice && !pending.length) return null;
  return <View accessibilityLiveRegion="polite" style={{ padding: theme.spacing.md, gap: theme.spacing.sm, backgroundColor: theme.colors.surface }}>
    <Text style={{ color: theme.colors.text }}>{notice || 'Adding share to inbox…'}</Text>
    {pending.length ? <V2Button disabled={busy} label={busy ? 'ADDING…' : `RETRY SHARE (${pending.length})`} onPress={() => { for (const url of pending) void capture(url); }} /> : null}
    {placeId ? <V2Button label="OPEN SAVED PLACE" onPress={() => { router.push(getPlaceDetailHref(placeId)); setNotice(''); }} /> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      <V2Button compact variant="secondary" label="VIEW INBOX" onPress={() => { if (pathname !== '/inbox') router.push(appRoutePaths.inbox); setNotice(''); }} />
      <V2Button compact variant="ghost" label={pending.length ? 'DISMISS SHARE' : 'CONTINUE'} disabled={busy} onPress={() => { setPending([]); setNotice(''); setPlaceId(null); }} />
    </View>
  </View>;
}
