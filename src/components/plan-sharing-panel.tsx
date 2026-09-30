import { useReducedMotion } from '../design-system/use-reduced-motion';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { V2Button, V2TextField } from './v2-controls';
import { V2SectionLabel, V2TopBar } from './v2-layout';
import { useAppTheme } from '../design-system/theme';
import { useSharing } from '../store/sharing-context';
import { SharingFailure, sharingMessage, type SharingDetails, type SharingAction } from '../services/owner-sharing';
import { createSharingReview } from '../services/sharing-content';

type Review = ReturnType<typeof createSharingReview> & { revision: number };
export function PlanSharingPanel({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  return <><V2Button variant="secondary" label="Manage read-only sharing" onPress={() => setOpen(true)}/>
    {open ? <SharingEditor key={planId} planId={planId} onClose={() => setOpen(false)}/> : null}</>;
}
export function SharingEditor({ planId, onClose }: { planId: string; onClose: () => void }) {
  const session = useSharing(); const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [details, setDetails] = useState<SharingDetails>();
  const [title, setTitle] = useState('');
  const [labels, setLabels] = useState<{ savedPlaceId: string; name: string; location: string }[]>([]);
  const [review, setReview] = useState<Review>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>(); const [uncertain, setUncertain] = useState(false);
  const mounted = useRef(true); const locked = useRef(false);
  const current = () => { session.guard()(); if (!mounted.current) throw Error('Closed'); };
  const adopt = (value: SharingDetails) => {
    setDetails(value); setTitle(value.title);
    setLabels(value.labels.map(l => ({ savedPlaceId: l.savedPlaceId, name: l.name ?? '', location: l.location ?? '' })));
    setReview(undefined); setUncertain(false);
  };
  const dirty = !!details && (title !== details.title || labels.some((l, i) => l.name !== (details.labels[i]?.name ?? '') || l.location !== (details.labels[i]?.location ?? '')));
  const run = async (work: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(undefined); setNotice(undefined);
    try { await work(); }
    catch (e) { if (mounted.current && session.active) { setReview(undefined); setUncertain(!(e instanceof SharingFailure && ['invalid', 'limited', 'busy'].includes(e.code))); setError(sharingMessage(e)); } }
    finally { locked.current = false; if (mounted.current && session.active) setBusy(false); }
  };
  const refresh = () => run(async () => { const value = await session.details(planId); current(); adopt(value); });
  useEffect(() => {
    mounted.current = true; void refresh();
    return () => { mounted.current = false; };
    // This editor is keyed by plan and the provider is keyed by account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = () => {
    if (Keyboard.isVisible()) { Keyboard.dismiss(); return; }
    if (locked.current) return;
    if (dirty) Alert.alert('Discard public edits?', 'Only saved public details are kept.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose }
    ]); else onClose();
  };
  const mutate = (action: SharingAction, revision: number, payload: Record<string, unknown> = {}) => run(async () => {
    await session.mutate(planId, action, revision, payload); current();
    const value = await session.details(planId); current(); adopt(value);
    if (action !== 'title') setTitle(title);
    setLabels(value.labels.map(saved => {
      const draft = labels.find(l => l.savedPlaceId === saved.savedPlaceId);
      return draft && !(action === 'label' && payload.savedPlaceId === saved.savedPlaceId)
        ? draft : { savedPlaceId: saved.savedPlaceId, name: saved.name ?? '', location: saved.location ?? '' };
    }));
    setNotice((action === 'disable' && value.enabled) || (['enable', 'regenerate'].includes(action) && !value.enabled) ? 'Sharing changed again. The latest confirmed status is shown above.' : action === 'disable' ? 'Link disabled. Previously viewed copies may remain.' : action === 'regenerate'
      ? 'Link replaced. The previous link no longer opens this plan.' : action === 'enable' ? 'Read-only sharing is enabled.' : 'Public details saved.');
  });
  const prepare = () => run(async () => {
    const value = await session.preview(planId); current();
    if (value.revision !== details?.revision) throw new Error('Changed');
    setReview({ ...createSharingReview(value.content), revision: value.revision });
  });
  const deliver = (mode: 'copy' | 'share' | 'open') => run(async () => {
    await session.deliver(planId, async url => {
      if (mode === 'copy') { if (!await Clipboard.setStringAsync(url)) throw new Error('Copy failed'); }
      else if (mode === 'open') await Linking.openURL(url);
      else await Share.share({ message: url });
    }, current); current();
    setNotice(mode === 'copy' ? 'Link copied. Anyone you send it to can forward it.' : mode === 'open' ? 'Public page opened.' : 'Share sheet closed.');
  });
  const text = { color: theme.colors.text, fontSize: 16 };
  const section = { gap: 12, paddingVertical: 18, borderBottomWidth: 1, borderColor: theme.colors.border };
  const editable = !busy && !uncertain;
  return <Modal visible animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={close}>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: theme.spacing.lg, gap: 18, paddingBottom: 48 }}>
          <V2TopBar onBack={close}/>
          <Text accessibilityRole="header" style={{ ...text, fontFamily: theme.typography.displayFamily, fontSize: 36 }}>READ-ONLY SHARING</Text>
          {!session.origin ? <Text style={text}>Links are not available in this build yet. You can prepare public details and disable an existing link.</Text> : null}
          {details ? <>
            <Text accessibilityLiveRegion="polite" style={text}>{uncertain ? 'Current sharing status needs confirmation.' : details.enabled ? 'Link enabled' : 'Link disabled'}</Text>
            <Text style={text}>Before you start: each place needs a public name written by you before you can preview or enable sharing. Locations are optional. Use information you know independently; imported names and your private plan title are never filled in here.</Text>
            <Text style={text}>When a link is enabled, saved public changes appear on the next open or refresh. A place without a public name makes the shared page unavailable.</Text>
            {labels.length ? <Text style={text}>{details.labels.filter(label => !!label.name).length} of {labels.length} public names saved. You can save your progress and finish later.</Text> : null}
            <View style={section}><V2TextField label="Public title" value={title} editable={editable} hint={`${[...title.trim()].length} / 80 characters`} onChangeText={value => { setTitle(value); setReview(undefined); }}/>
              <V2Button label="Save public title" disabled={!editable || title === details.title || !title.trim() || [...title.trim()].length > 80} onPress={() => void mutate('title', details.revision, { title: title.trim() })}/></View>
            {labels.map((label, i) => <View key={label.savedPlaceId} style={section}>
              <V2SectionLabel>Place {i + 1} in your shortlist</V2SectionLabel>
              <V2TextField label={`Public name for place ${i + 1}`} value={label.name} editable={editable} hint={`${[...label.name.trim()].length} / 200 characters`} onChangeText={name => { setLabels(rows => rows.map((row, n) => n === i ? { ...row, name } : row)); setReview(undefined); }}/>
              <V2TextField label={`Public location for place ${i + 1} (optional)`} value={label.location} editable={editable} hint={`${[...label.location.trim()].length} / 300 characters`} onChangeText={location => { setLabels(rows => rows.map((row, n) => n === i ? { ...row, location } : row)); setReview(undefined); }}/>
              <V2Button label={`Save public details for place ${i + 1}`} disabled={!editable || !label.name.trim() || [...label.name.trim()].length > 200 || [...label.location.trim()].length > 300 || (label.name === details.labels[i].name && label.location === (details.labels[i].location ?? ''))} onPress={() => void mutate('label', details.revision, { savedPlaceId: label.savedPlaceId, name: label.name.trim(), location: label.location.trim() || null, provenance: 'owner_authored' })}/>
            </View>)}
            {!labels.length ? <Text style={text}>This is an empty shortlist. The shared page will show only your public title.</Text> : null}
            {dirty ? <Text style={text}>Save your public edits before reviewing or sharing.</Text> : null}
            <V2Button label="Review public preview" disabled={!editable || dirty || details.labels.some(l => !l.name)} onPress={() => void prepare()}/>
            {review ? <View style={section}>
              <V2SectionLabel>Public preview</V2SectionLabel>
              <Text accessibilityRole="header" style={{ ...text, fontSize: 24 }}>{review.content.title}</Text>
              {review.content.places.map((place, i) => <View key={i} style={section}><Text style={text}>{i + 1}. {place.name}</Text>{place.location ? <Text style={text}>{place.location}</Text> : null}
                {place.mapUrl ? <V2Button variant="secondary" label={`Open map for ${place.name}`} onPress={() => void run(async () => { await Linking.openURL(place.mapUrl!); })}/> : <Text style={text}>No map link</Text>}
              </View>)}
              {Object.entries(review.disclosure).filter(([key]) => key !== 'confirmation').map(([key, value]) => <Text key={key} style={text}>{value}</Text>)}
              {!details.enabled ? <V2Button label={review.disclosure.confirmation} disabled={!editable || !session.origin || dirty} onPress={() => void mutate('enable', review.revision)}/> : null}
            </View> : null}
            {details.enabled ? <View style={section}>
              <V2Button label="Copy link" disabled={!editable || dirty || !session.origin} onPress={() => void deliver('copy')}/>
              <V2Button label="Share link" disabled={!editable || dirty || !session.origin} onPress={() => void deliver('share')}/>
              <V2Button label="View public page" disabled={!editable || dirty || !session.origin} onPress={() => void deliver('open')}/>
              <V2Button variant="secondary" label="Replace link" disabled={!editable || dirty || !review || !session.origin} onPress={() => Alert.alert('Replace this link?', 'The old link will stop working. Copies already viewed may remain.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Replace link', onPress: () => void mutate('regenerate', review!.revision) }])}/>
              <V2Button variant="danger" label="Disable link" disabled={!editable} onPress={() => Alert.alert('Disable this link?', 'Future access will stop. Already displayed content and copies cannot be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disable link', style: 'destructive', onPress: () => void mutate('disable', details.revision) }])}/>
            </View> : null}
          </> : null}
          <V2Button variant="ghost" label={busy ? 'Please wait…' : 'Done'} disabled={busy} onPress={close}/>
        </ScrollView>
        {(busy || error || notice || !details || uncertain) ? <View style={{ padding: theme.spacing.lg, gap: 10, borderTopWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background }}>
          {busy ? <ActivityIndicator accessibilityLabel="Updating sharing" color={theme.colors.text}/> : null}
          {error ? <Text accessibilityRole="alert" style={text}>{error}</Text> : null}
          {notice ? <Text accessibilityLiveRegion="polite" style={text}>{notice}</Text> : null}
          {(!details || uncertain) ? <V2Button label="Refresh sharing status" disabled={busy} onPress={() => {
            if (dirty) Alert.alert('Reload saved public details?', 'Unsaved edits will be discarded.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Reload', onPress: () => void refresh() }]);
            else void refresh();
          }}/> : null}
        </View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
