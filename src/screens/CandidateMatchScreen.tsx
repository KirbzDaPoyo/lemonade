import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../components/screen-header';
import { StatePanel } from '../components/state-panel';
import { AppTheme, useAppTheme } from '../design-system/theme';
import { AppNavigation } from '../navigation/types';
import type { PlaceInput } from '../repositories/savedPlaces/types';
import { resolveCandidatePlaceCategory } from '../services/classification/place-category-resolver';
import { suggestUserTags } from '../services/tags/user-tags';
import { usePlaces } from '../store/PlacesContext';
import { DraftPlaceEntry, PlaceCandidate } from '../types/place';
import { categoryLabels } from '../utils/labels';

type CandidateMatchScreenProps = { navigation: AppNavigation; draft: DraftPlaceEntry; candidates: PlaceCandidate[] };
type SavePlaceInput = Omit<PlaceInput, 'sourceInstagramUrl' | 'status' | 'isFavorite'>;

export function CandidateMatchScreen({ navigation, draft, candidates }: CandidateMatchScreenProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { addPlace, availableTags } = usePlaces();
  const [savingKey, setSavingKey] = useState<string>();
  const saveInFlightRef = useRef(false);
  const extraction = draft.extraction;
  const availableTagNames = availableTags.map((tag) => tag.name);
  const sharedTagClues = [extraction?.placeName, extraction?.cuisineOrSpecialty, ...(extraction?.vibeTags ?? []), ...(extraction?.recommendedItems ?? [])];

  const saveOnce = async (saveKey: string, save: () => ReturnType<typeof addPlace>, failureMessage: string) => {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSavingKey(saveKey);
    try {
      const savedPlace = await save();
      if (savedPlace) navigation.replace({ name: 'PlaceDetail', placeId: savedPlace.id });
      else Alert.alert('Save failed', failureMessage);
    } finally {
      saveInFlightRef.current = false;
      setSavingKey(undefined);
    }
  };

  const savePlace = (saveKey: string, place: SavePlaceInput, failureMessage: string) => saveOnce(saveKey, () => addPlace({ ...place, sourceInstagramUrl: draft.sourceInstagramUrl, isFavorite: false, status: 'want_to_go' }), failureMessage);

  const handleSaveCandidate = async (candidate: PlaceCandidate) => {
    const category = resolveCandidatePlaceCategory(candidate, extraction);
    const cuisineOrSpecialty = candidate.cuisineOrSpecialty || extraction?.cuisineOrSpecialty || undefined;
    const suggestedTags = suggestUserTags(availableTagNames, [candidate.name, category, cuisineOrSpecialty, ...candidate.tags, ...sharedTagClues]);
    await savePlace(candidate.providerPlaceId, { placeName: candidate.name, address: candidate.address, areaCity: candidate.areaCity, category, cuisineOrSpecialty, tags: suggestedTags, mapUrl: candidate.mapUrl, placeId: candidate.providerPlaceId }, 'The place could not be saved. Check the storage error.');
  };

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        data={candidates}
        keyExtractor={(candidate) => candidate.providerPlaceId}
        ListHeaderComponent={<View style={styles.headerStack}><ScreenHeader onBack={navigation.goBack} title="Match Place" /><View style={styles.intro}><Text style={styles.title}>CHOOSE THE MATCH</Text><Text style={styles.body}>Review the candidates. Only the place you select will be saved.</Text></View><Text style={styles.indexLabel}>Candidates / {candidates.length}</Text></View>}
        ListEmptyComponent={<StatePanel title="No candidates found" body="Go back, adjust the place name, and search again." />}
        renderItem={({ item, index }) => <CandidateRow candidate={item} disabled={Boolean(savingKey)} index={index + 1} isSaving={savingKey === item.providerPlaceId} onPress={() => void handleSaveCandidate(item)} />}
      />
    </View>
  );
}

function CandidateRow({ candidate, disabled, index, isSaving, onPress }: { candidate: PlaceCandidate; disabled: boolean; index: number; isSaving: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.candidateRow, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.rowIndex}>{String(index).padStart(2, '0')}</Text>
      <View style={styles.candidateContent}>
        <View style={styles.candidateHeader}>
          <View style={styles.candidateText}><Text style={styles.candidateName}>{candidate.name}</Text><Text style={styles.candidateMeta}>{categoryLabels[candidate.category]} / {candidate.areaCity}</Text></View>
          <Text style={styles.selectText}>{isSaving ? 'SAVING' : 'SELECT'}</Text>
        </View>
        <Text style={styles.address}>{candidate.address}</Text>
        {candidate.cuisineOrSpecialty ? <Text style={styles.specialty}>{candidate.cuisineOrSpecialty}</Text> : null}
        {candidate.rating ? <Text style={styles.rating}>Rating {candidate.rating.toFixed(1)}{candidate.userRatingCount ? ` (${candidate.userRatingCount})` : ''}</Text> : null}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.colors.background, flex: 1 },
  listContent: { paddingBottom: theme.spacing.huge, paddingHorizontal: theme.spacing.lg },
  headerStack: { gap: theme.spacing.xl, paddingBottom: theme.spacing.lg },
  intro: { gap: theme.spacing.sm },
  title: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: theme.typography.display.screen, lineHeight: 42 },
  body: { color: theme.colors.textMuted, fontSize: theme.typography.body.large, lineHeight: 24 },
  indexLabel: { color: theme.colors.textMuted, fontSize: theme.typography.label.small, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  candidateRow: { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: theme.spacing.md, minHeight: 150, paddingVertical: theme.spacing.lg },
  rowIndex: { color: theme.colors.primaryPressed, fontFamily: theme.typography.displayFamily, fontSize: 20, lineHeight: 23, minWidth: 28 },
  candidateContent: { flex: 1, gap: theme.spacing.md, paddingRight: theme.spacing.sm },
  candidateHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'space-between' },
  candidateText: { flex: 1, gap: theme.spacing.xs },
  candidateName: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 25, lineHeight: 27, textTransform: 'uppercase' },
  candidateMeta: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, fontWeight: '700' },
  selectText: { color: theme.colors.cobalt, fontSize: theme.typography.label.small, fontWeight: '900', letterSpacing: 1 },
  address: { color: theme.colors.text, fontSize: theme.typography.body.medium, lineHeight: 21 },
  specialty: { color: theme.colors.violet, fontSize: theme.typography.body.small, fontWeight: '800' },
  rating: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, fontVariant: ['tabular-nums'], fontWeight: '700' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.46 }
});
