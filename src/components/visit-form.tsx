import { useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../design-system/theme';
import { useReducedMotion } from '../design-system/use-reduced-motion';
import { localVisitDate, newVisitId, validateVisitDraft, type Visit, type VisitDraft } from '../types/visit';
import { V2Button, V2TextField } from './v2-controls';
import { V2SectionLabel } from './v2-layout';

export function VisitForm({ original, onSave, onClose, error }: {
  original?: Visit; onSave: (draft: VisitDraft) => Promise<boolean>; onClose: (saved?: boolean) => void; error: string | null;
}) {
  const { theme } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [initial] = useState<VisitDraft>(() => ({ id: original?.id ?? newVisitId(),
    visitDate: original?.visitDate ?? localVisitDate(), rating: original?.rating ?? null, note: original?.note ?? '' }));
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const inFlight = useRef(false);
  const dirty = draft.visitDate !== initial.visitDate || draft.rating !== initial.rating || draft.note !== initial.note;
  const text = { color: theme.colors.text, fontSize: theme.typography.body.medium };
  const close = () => {
    if (inFlight.current) return;
    if (Keyboard.isVisible()) { Keyboard.dismiss(); return; }
    if (dirty || attempted) Alert.alert(attempted ? 'Close this visit form?' : 'Discard visit changes?',
      attempted ? 'The save may already have reached your journal. Close and refresh history before logging another visit.' : 'Your unsaved changes will be lost.',
      [{ text: 'Keep editing', style: 'cancel' }, { text: 'Close form', style: 'destructive', onPress: () => onClose(false) }]);
    else onClose();
  };
  const save = async () => {
    if (inFlight.current) return;
    const invalid = validateVisitDraft(draft, attempted ? '9999-12-31' : undefined, original?.visitDate);
    setValidation(invalid);
    if (invalid) return;
    inFlight.current = true; setBusy(true); setAttempted(true); Keyboard.dismiss();
    try { if (await onSave(draft)) onClose(true); }
    catch { setValidation('The save could not be confirmed. Your draft is kept; please retry.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const chooseRelativeDay = (days: number) => {
    const date = new Date(); date.setDate(date.getDate() + days);
    setDraft(current => ({ ...current, visitDate: localVisitDate(date) }));
  };
  return <Modal visible animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={close}>
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.huge }}>
          <Text accessibilityRole="header" style={{ ...text, fontSize: 30, fontFamily: theme.typography.displayFamily }}>{original ? 'Edit visit' : 'Log a visit'}</Text>
          <Text style={text}>{original ? 'Update your private memory of this visit.' : 'A date is all you need. Saving a new visit marks this place Visited.'}</Text>
          <V2TextField label="Visit date" hint="Required · YYYY-MM-DD" value={draft.visitDate} editable={!attempted}
            autoCorrect={false} autoCapitalize="none" placeholder="YYYY-MM-DD" returnKeyType="done" onSubmitEditing={Keyboard.dismiss}
            onChangeText={visitDate => setDraft(current => ({ ...current, visitDate }))} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <V2Button compact label="Today" variant="secondary" disabled={attempted} onPress={() => chooseRelativeDay(0)} />
            <V2Button compact label="Yesterday" variant="secondary" disabled={attempted} onPress={() => chooseRelativeDay(-1)} />
          </View>
          <V2SectionLabel>Your rating · optional</V2SectionLabel>
          <Text style={text}>Your own 1–5 rating, separate from any Google rating.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {[1, 2, 3, 4, 5].map(rating => <V2Button key={rating} compact label={String(rating)}
              accessibilityLabel={`Your rating: ${rating} out of 5`} selected={draft.rating === rating}
              variant={draft.rating === rating ? 'primary' : 'secondary'} disabled={attempted}
              onPress={() => setDraft(current => ({ ...current, rating }))} />)}
          </View>
          <V2Button label="No rating" variant={draft.rating === null ? 'primary' : 'secondary'} selected={draft.rating === null}
            disabled={attempted} onPress={() => setDraft(current => ({ ...current, rating: null }))} />
          <V2TextField label="Reflection · optional" hint={`${Array.from(draft.note).length.toLocaleString()} / 2,000 characters`}
            value={draft.note} editable={!attempted} multiline textAlignVertical="top" placeholder="What would you like to remember?"
            onChangeText={note => setDraft(current => ({ ...current, note }))} />
          {validation || error ? <Text selectable accessibilityRole="alert" style={{ ...text, color: theme.colors.danger }}>{validation ?? error}</Text> : null}
          {attempted && !busy ? <Text style={text}>Your draft is kept. Retry the same save to avoid duplicates. To change it, close this form and refresh history first.</Text> : null}
          <V2Button label={busy ? 'Saving visit…' : attempted ? 'Retry save' : 'Save visit'} disabled={busy} onPress={() => void save()} />
          <V2Button label="Cancel" variant="ghost" disabled={busy} onPress={close} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
