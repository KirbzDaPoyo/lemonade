import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { StatePanel } from '../components/state-panel';
import { V2Button, V2TextField } from '../components/v2-controls';
import { V2TitleBlock, V2TopBar } from '../components/v2-layout';
import { AppTheme, useAppTheme } from '../design-system/theme';
import type { AppNavigation } from '../navigation/types';
import { useImportFlow } from '../navigation/import-flow-context';
import { analytics } from '../observability/analytics';
import { useInbox } from '../store/inbox-context';
import type { CaptureSummary } from '../types/inbox';

export const describeCapture = (s: CaptureSummary) => `${s.queued} added · ${s.already_queued} already queued · ${s.already_saved} already saved · ${s.invalid} invalid · ${s.capacity_reached} capacity limited · ${s.duplicate} repeated in paste · ${s.omitted} over the 20-link limit`;
export function V2InboxScreen({ navigation }: { navigation: AppNavigation }) {
  const { active, draft } = useImportFlow();
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { items, loading, error, refresh, enqueue, remove, clear } = useInbox();
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useFocusEffect(useCallback(() => { analytics.inboxOpened(); void refresh(); }, [refresh]));
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await action(); } finally { lock.current = false; setBusy(false); }
  };
  const capture = () => void run(async () => {
    try {
      const { summary, results } = await enqueue(text, 'manual');
      setMessage(`${summary.queued ? 'Capture complete.' : 'No new links added.'} ${describeCapture(summary)}`);
      // Keep only retryable canonical links, never the complete copied text.
      setText(results.filter(r => r.outcome === 'capacity_reached').map(r => r.sourceUrl).join('\n'));
    } catch { setMessage('Could not add links. Your input remains here; retry when connected.'); }
  });
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <FlatList data={items} keyExtractor={item => item.id} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" refreshing={loading} onRefresh={() => void refresh()}
      ListHeaderComponent={<View style={styles.stack}>
        <V2TopBar onBack={navigation.goBack} />
        <V2TitleBlock title={`INBOX / ${items.length}`} subtitle="Save links now. Instagram and place searches run only after you choose Process, then Find Place." />
        {active ? <V2Button label="RESUME CURRENT IMPORT" onPress={() => router.dismissTo(draft ? '/match-place' : '/add-place')} /> : null}
        <V2TextField label="Paste Instagram links" multiline maxLength={50000} value={text} onChangeText={setText} autoCapitalize="none" autoCorrect={false} placeholder="Paste one or several posts or reels (up to 20)" />
        <V2Button label={busy ? 'WORKING…' : 'ADD TO INBOX'} disabled={busy || !text.trim()} onPress={capture} />
        {message ? <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.warning}>{error}</Text> : null}
        <V2Button compact variant="ghost" label="REFRESH" disabled={loading || busy} onPress={() => void refresh()} />
        {items.length ? <V2Button compact variant="danger" label="CLEAR INBOX" disabled={busy} onPress={() => Alert.alert('Clear inbox?', `Remove all pending links, including those needing attention? Saved places and sources are kept.`, [ { text: 'Cancel', style: 'cancel' }, { text: 'Clear inbox', style: 'destructive', onPress: () => void run(async () => { if (await clear()) setMessage('Inbox cleared.'); }) } ])} /> : null}
      </View>}
      ListEmptyComponent={!loading ? <StatePanel title={error ? 'Inbox unavailable' : 'Room for your next discovery'} body={error ? 'Refresh when connected to see your pending links.' : 'Share an Instagram post to Lemonade or paste links above. Nothing is processed automatically.'} /> : <StatePanel loading title="Loading inbox" />}
      renderItem={({ item }) => <View style={styles.row}>
        <Text selectable style={styles.title}>{item.sourceUrl.includes('/reel/') ? 'REEL' : 'POST'} / {item.sourceUrl.split('/').filter(Boolean).pop()}</Text>
        <Text style={styles.text}>{item.origin === 'share' ? 'Shared' : 'Pasted'} · {new Date(item.createdAt).toLocaleDateString()}</Text>
        {item.placeNameHint ? <Text selectable style={styles.text}>{item.placeNameHint}</Text> : null}
        {item.status === 'needs_attention' ? <Text style={styles.warning}>Needs attention · {item.failureCategory?.replace(/_/g, ' ') ?? 'Try again'} · Adjust the hint or retry when ready.</Text> : null}
        <View style={styles.actions}>
          <V2Button compact label="PROCESS" disabled={busy || active} onPress={() => navigation.navigate({ name: 'AddPlace', inboxItem: item })} />
          <V2Button compact variant="ghost" label="DELETE" disabled={busy} onPress={() => void run(async () => { await remove(item.id); })} />
        </View>
      </View>}
    />
  </KeyboardAvoidingView>;
}
const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.huge, width: '100%', maxWidth: 820, alignSelf: 'center' },
  stack: { gap: theme.spacing.md },
  row: { padding: theme.spacing.md, gap: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
  title: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 22 },
  text: { color: theme.colors.text, fontSize: theme.typography.body.small },
  warning: { color: theme.colors.warning, fontSize: theme.typography.body.small },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }
});
