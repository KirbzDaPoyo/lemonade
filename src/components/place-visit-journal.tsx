import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { getCalendars } from 'expo-localization';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '../design-system/theme';
import { errorMonitoring } from '../observability/error-monitoring';
import { VisitJournal, type JournalState } from '../services/visit-journal';
import { useVisits } from '../store/visits-context';
import { usePlaces } from '../store/PlacesContext';
import { formatVisitDate, type Visit } from '../types/visit';
import { V2Button } from './v2-controls';
import { V2SectionLabel } from './v2-layout';
import { VisitForm } from './visit-form';

export function PlaceVisitJournal({ placeId, disabled, onBusyChange, logVisit = false }: {
  logVisit?: boolean; placeId: string; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const { theme } = useAppTheme();
  const session = useVisits();
  const { applyVisitPlaceStatus, retryStorage } = usePlaces();
  const callbacks = useRef({ applyVisitPlaceStatus, retryStorage });
  callbacks.current = { applyVisitPlaceStatus, retryStorage };
  const [view, setView] = useState<{ journal: VisitJournal; state: JournalState } | null>(null);
  const [editor, setEditor] = useState<{ original?: Visit; zone: string } | null>(null);
  const shortcutConsumed = useRef(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  useEffect(() => {
    const journal = new VisitJournal(session, placeId,
      page => callbacks.current.applyVisitPlaceStatus(placeId, page.placeStatus, page.placeUpdatedAt),
      () => callbacks.current.retryStorage(),
      () => errorMonitoring.captureException(new Error('Visit storage operation failed'), { operation: 'visit_storage', category: 'storage' }));
    setView({ journal, state: journal.state });
    const unsubscribe = journal.subscribe(() => setView({ journal, state: journal.state }));
    return () => { unsubscribe(); journal.dispose(); };
  }, [session, placeId]);
  const journal = view?.journal;
  useFocusEffect(useCallback(() => { void journal?.refresh(); }, [journal]));
  const state = view?.state;
  useEffect(() => { onBusyChange(Boolean(state?.busy)); return () => onBusyChange(false); }, [state?.busy, onBusyChange]);
  const open = useCallback((original?: Visit) => {
    const zone = getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) { Alert.alert('Device time zone unavailable', 'Enable an automatic time zone in device settings, then try again.'); return; }
    setEditor({ original, zone });
  }, []);
  useEffect(() => {
    if (logVisit && !shortcutConsumed.current && journal && session.active && !disabled) {
      shortcutConsumed.current = true;
      open();
    }
  }, [logVisit, journal, session, disabled, open]);
  const remove = async (id: string) => {
    setDeleteId(id);
    if (await journal?.remove(id)) setDeleteId(null);
  };
  const confirmDelete = (visit: Visit) => Alert.alert('Delete this visit?',
    `Remove the visit on ${formatVisitDate(visit.visitDate)}? This cannot be undone. The place status will stay as it is.`,
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete visit', style: 'destructive', onPress: () => void remove(visit.id) }]);
  const text = { color: theme.colors.text, fontSize: theme.typography.body.medium };
  const page = state?.page;
  const busy = disabled || Boolean(state?.busy) || !journal;
  if (!session.active) return null;
  return <View style={{ gap: theme.spacing.md }}>
    <V2SectionLabel>Your visit history</V2SectionLabel>
    <V2Button label="Log a visit" disabled={busy} onPress={() => open()} />
    {state?.notice ? <Text selectable accessibilityLiveRegion="polite" style={text}>{state.notice}</Text> : null}
    {state?.loading ? <Text accessibilityLiveRegion="polite" style={text}>Loading visits…</Text> : null}
    {state?.busy ? <Text accessibilityLiveRegion="polite" style={text}>Updating your journal…</Text> : null}
    {state?.error || (state?.mutationError && !editor) ? <View style={{ gap: theme.spacing.sm }}>
      <Text selectable accessibilityRole="alert" style={{ ...text, color: theme.colors.danger }}>{state.error ?? state.mutationError}</Text>
      {page ? <Text style={text}>Showing the last loaded history. Refresh to check for changes.</Text> : null}
      <V2Button label="Retry history" variant="secondary" disabled={busy || state.loading} onPress={() => void journal?.retryPage()} />
    </View> : null}
    {deleteId && state?.mutationError ? <V2Button label="Retry deletion" variant="danger" disabled={busy} onPress={() => void remove(deleteId)} /> : null}
    {page ? <>
      <Text selectable style={text}>{page.summary.count} recorded {page.summary.count === 1 ? 'visit' : 'visits'}</Text>
      {page.summary.latestDate ? <Text selectable style={text}>Most recent visit: {formatVisitDate(page.summary.latestDate)}</Text> : null}
      {page.summary.latestRated ? <Text selectable style={text}>Your most recent rated visit: {page.summary.latestRated.rating}/5 · {formatVisitDate(page.summary.latestRated.visitDate)}</Text>
        : page.summary.count > 0 ? <Text style={text}>No personal ratings recorded yet.</Text> : null}
      {page.summary.count === 0 ? <Text style={text}>Start with a day you remember. A place marked Visited can still have no recorded visits.</Text> : null}
      {page.entries.map(visit => <View key={visit.id} style={{ borderTopColor: theme.colors.border, borderTopWidth: 1, paddingTop: theme.spacing.md, gap: theme.spacing.sm }}>
        <Text selectable accessibilityRole="header" style={{ ...text, fontWeight: '700' }}>{formatVisitDate(visit.visitDate)}</Text>
        <Text selectable style={text}>{visit.rating === null ? 'No personal rating' : `Your rating: ${visit.rating}/5`}</Text>
        {visit.note ? <Text selectable style={text}>{visit.note}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <V2Button compact label="Edit visit" accessibilityLabel={`Edit visit on ${formatVisitDate(visit.visitDate)}`} variant="secondary" disabled={busy} onPress={() => open(visit)} />
          <V2Button compact label="Delete visit" accessibilityLabel={`Delete visit on ${formatVisitDate(visit.visitDate)}`} variant="danger" disabled={busy} onPress={() => confirmDelete(visit)} />
        </View>
      </View>)}
      {state.pageNumber > 1 || page.hasMore ? <View style={{ gap: theme.spacing.sm }}>
        <Text accessibilityLiveRegion="polite" style={text}>History page {state.pageNumber} · up to 20 visits per page</Text>
        {state.pageNumber > 1 ? <V2Button label="Newer visits" variant="secondary" disabled={busy || state.loading} onPress={() => void journal?.newer()} /> : null}
        {page.hasMore ? <V2Button label="Older visits" variant="secondary" disabled={busy || state.loading} onPress={() => void journal?.older()} /> : null}
      </View> : null}
      <V2Button label="Refresh history" variant="ghost" disabled={busy || state.loading} onPress={() => void journal?.refresh()} />
    </> : null}
    {editor && journal ? <VisitForm key={editor.original?.id ?? 'new'} original={editor.original} error={state?.mutationError ?? null}
      onSave={draft => journal.save(draft, editor.zone, editor.original)}
      onClose={saved => { setEditor(null); if (!saved && !journal.state.busy) void journal.refresh(); }} /> : null}
  </View>;
}
