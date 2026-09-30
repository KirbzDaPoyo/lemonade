import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { V2Button } from '../components/v2-controls';
import { useAppTheme } from '../design-system/theme';
import { recipientLinks } from '../navigation/recipient-links';
import { retrieveSharedPlan, RecipientFailure } from '../services/recipient-sharing';
import type { SharedPlanContent } from '../services/sharing-content';

export function SharedPlanScreen() {
  const { theme } = useAppTheme(); const router = useRouter();
  const [version, setVersion] = useState(recipientLinks.getVersion);
  const [content, setContent] = useState<SharedPlanContent>();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const sequence = useRef(0); const request = useRef<AbortController | undefined>(undefined); const focused = useRef(false);
  const reset = useCallback(() => { sequence.current++; request.current?.abort(); request.current = undefined; setContent(undefined); setBusy(false); }, []);
  const load = useCallback(async () => {
    reset(); const current = sequence.current; const token = recipientLinks.getToken();
    if (!focused.current || (AppState.currentState && AppState.currentState !== 'active')) return;
    if (!token) { setMessage('This link is unavailable. Ask the sender for a current link.'); return; }
    const controller = new AbortController(); request.current = controller; setBusy(true); setMessage('Opening this shortlist…');
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const value = await retrieveSharedPlan(token, controller.signal);
      if (current !== sequence.current || !focused.current || controller.signal.aborted) return;
      setContent(value); setMessage(value.places.length ? `${value.places.length} ${value.places.length === 1 ? 'place' : 'places'} · In the order shared` : 'No places yet. Refresh later to check for updates.');
    } catch (error) {
      if (current !== sequence.current || !focused.current) return;
      setMessage(error instanceof RecipientFailure && error.code === 'unavailable' ? 'This link is unavailable. Ask the sender for a current link.'
        : error instanceof RecipientFailure && error.code === 'limited' ? 'Sharing is busy. Wait a minute, then refresh.' : 'Could not load this shortlist. Check your connection, then refresh.');
    } finally { clearTimeout(timeout); if (current === sequence.current) setBusy(false); }
  }, [reset]);
  useEffect(() => recipientLinks.subscribe(() => { reset(); setVersion(recipientLinks.getVersion()); }), [reset]);
  useFocusEffect(useCallback(() => {
    focused.current = true; void load();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); else { reset(); setMessage('Refresh to check the latest shortlist.'); } });
    return () => { focused.current = false; subscription.remove(); reset(); };
  }, [load, reset, version]));
  const leave = () => { recipientLinks.clear(); if (router.canGoBack()) router.back(); else router.replace('/'); };
  const text = { color: theme.colors.text, fontSize: 16 };
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: theme.spacing.lg, gap: 20, paddingBottom: 48 }} style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <V2Button variant="ghost" label="Close shortlist" onPress={leave}/>
    <Text style={text}>Shared with you · Read-only</Text>
    <Text accessibilityRole="header" style={{ ...text, fontFamily: theme.typography.displayFamily, fontSize: 36 }}>{content?.title ?? 'SHARED SHORTLIST'}</Text>
    {busy ? <ActivityIndicator accessibilityLabel="Loading shared shortlist" color={theme.colors.text}/> : null}
    <Text accessibilityLiveRegion="polite" style={text}>{message}</Text>
    <V2Button label={busy ? 'Loading…' : 'Refresh shortlist'} disabled={busy} onPress={() => void load()}/>
    {content?.places.map((place, i) => <View key={i} style={{ gap: 10, paddingVertical: 18, borderBottomWidth: 1, borderColor: theme.colors.border }}>
      <Text accessibilityRole="header" style={{ ...text, fontSize: 24 }}>{i + 1}. {place.name}</Text>
      {place.location ? <Text style={text}>{place.location}</Text> : null}
      {place.mapUrl ? <V2Button variant="secondary" label={`Open Google Maps for ${place.name}`} onPress={() => void Linking.openURL(place.mapUrl!).catch(() => setMessage('Could not open Google Maps. Try again.'))}/> : null}
    </View>)}
    <Text style={text}>Lemonade helps you save places and make shortlists for your next outing. Anyone with this link can view and forward it.</Text>
    <Text style={text}>Names and locations are written by the sender. Maps open separately in Google Maps. The owner can update or disable the link; refresh to check the latest version.</Text>
  </ScrollView>;
}
