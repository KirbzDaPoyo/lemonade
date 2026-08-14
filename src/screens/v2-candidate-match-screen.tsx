import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { StatePanel } from '../components/state-panel';
import { V2Button } from '../components/v2-controls';
import { PlaceGlyph } from '../components/v2-marks';
import { V2TitleBlock, V2TopBar } from '../components/v2-layout';
import { AppTheme, useAppTheme } from '../design-system/theme';
import type { AppNavigation } from '../navigation/types';
import { analytics } from '../observability/analytics';
import type { PlaceInput } from '../repositories/savedPlaces/types';
import { resolveCandidatePlaceCategory } from '../services/classification/place-category-resolver';
import { suggestUserTags } from '../services/tags/user-tags';
import { usePlaces } from '../store/PlacesContext';
import type { DraftPlaceEntry, PlaceCandidate } from '../types/place';
import { categoryLabels } from '../utils/labels';

type V2CandidateMatchScreenProps = { navigation: AppNavigation; draft: DraftPlaceEntry; candidates: PlaceCandidate[] };
type SavePlaceInput = Omit<PlaceInput, 'sourceInstagramUrl' | 'status' | 'isFavorite'>;

export function V2CandidateMatchScreen({ navigation, draft, candidates }: V2CandidateMatchScreenProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { addPlace, availableTags } = usePlaces();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string>();
  const [saveDockHeight, setSaveDockHeight] = useState(0);
  const saveInFlightRef = useRef(false);
  const extraction = draft.extraction;
  const selectedCandidate = candidates.find((candidate) => candidate.providerPlaceId === selectedCandidateId) ?? null;
  const availableTagNames = availableTags.map((tag) => tag.name);
  const sharedTagClues = [extraction?.placeName, extraction?.cuisineOrSpecialty, ...(extraction?.vibeTags ?? []), ...(extraction?.recommendedItems ?? [])];

  const saveOnce = async (saveKey: string, save: () => ReturnType<typeof addPlace>, failureMessage: string) => {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSavingKey(saveKey);
    try {
      const savedPlace = await save();
      if (savedPlace) {
        analytics.placeSaved(savedPlace.status);
        navigation.replace({ name: 'PlaceDetail', placeId: savedPlace.id });
      } else Alert.alert('Save failed', failureMessage);
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
        contentContainerStyle={[styles.listContent, candidates.length > 0 && { paddingBottom: saveDockHeight + theme.spacing.lg }]}
        contentInsetAdjustmentBehavior="automatic"
        data={candidates}
        keyExtractor={(candidate) => candidate.providerPlaceId}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <V2TopBar onBack={navigation.goBack} />
            <V2TitleBlock subtitle="Select the correct result. You will review it before anything is saved." title="MATCH PLACE" />
          </View>
        }
        ListEmptyComponent={<StatePanel title="No candidates found" body="Go back, adjust the place name, and search again." />}
        renderItem={({ item, index }) => (
          <CandidateModule
            candidate={item}
            disabled={Boolean(savingKey)}
            index={index}
            onPress={() => {
              analytics.candidateSelected(index + 1);
              setSelectedCandidateId(item.providerPlaceId);
            }}
            selected={selectedCandidateId === item.providerPlaceId}
          />
        )}
      />

      {candidates.length > 0 ? (
        <View accessibilityLiveRegion="polite" onLayout={(event: LayoutChangeEvent) => setSaveDockHeight(Math.ceil(event.nativeEvent.layout.height))} style={styles.saveDock}>
          <View style={styles.saveCopy}>
            <Text style={styles.saveEyebrow}>{savingKey ? 'SAVING PLACE' : selectedCandidate ? 'SELECTED PLACE' : 'NO PLACE SELECTED'}</Text>
            <Text numberOfLines={1} style={styles.saveName}>{savingKey ? 'Adding to your private index...' : selectedCandidate?.name ?? 'Choose one match above'}</Text>
          </View>
          {savingKey ? <ActivityIndicator color={theme.colors.acidInk} size="large" /> : null}
          <V2Button
            compact
            disabled={!selectedCandidate || Boolean(savingKey)}
            label={savingKey ? 'SAVING' : 'SAVE PLACE'}
            onPress={() => selectedCandidate && void handleSaveCandidate(selectedCandidate)}
            style={styles.saveButton}
          />
        </View>
      ) : null}
    </View>
  );
}

function CandidateModule({ candidate, disabled, index, onPress, selected }: { candidate: PlaceCandidate; disabled: boolean; index: number; onPress: () => void; selected: boolean }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const topResult = index === 0;

  return (
    <Pressable
      accessibilityLabel={`${candidate.name}, ${candidate.areaCity}. ${topResult ? 'Top result. ' : ''}${selected ? 'Selected' : 'Select this place'}`}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.candidate, topResult && styles.topCandidate, selected && styles.selectedCandidate, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <PlaceGlyph label={candidate.name} outline={!selected && !topResult} />
      <View style={styles.candidateContent}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text numberOfLines={2} style={styles.name}>{candidate.name}</Text>
            <Text style={styles.meta}>{categoryLabels[candidate.category]} Â· {candidate.areaCity}</Text>
          </View>
          {topResult ? <Text style={styles.topResult}>TOP RESULT</Text> : null}
        </View>
        <Text numberOfLines={3} style={styles.address}>{candidate.address}</Text>
        <View style={styles.bottomRow}>
          <Text style={styles.rating}>{candidate.rating ? `RATING ${candidate.rating.toFixed(1)}${candidate.userRatingCount ? ` (${candidate.userRatingCount})` : ''}` : 'MATCH FOUND'}</Text>
          <View style={[styles.selectButton, selected && styles.selectButtonSelected]}>
            <Text style={[styles.selectLabel, selected && styles.selectLabelSelected]}>{selected ? 'SELECTED' : 'SELECT'}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.colors.background, flex: 1 },
  listContent: { gap: theme.spacing.md, padding: theme.spacing.lg, paddingBottom: theme.spacing.huge },
  headerStack: { gap: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  candidate: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, borderWidth: 1, flexDirection: 'row', gap: theme.spacing.md, minHeight: 148, padding: theme.spacing.md },
  topCandidate: { borderColor: theme.colors.acidBorder },
  selectedCandidate: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary, borderWidth: 2 },
  candidateContent: { flex: 1, gap: theme.spacing.xs },
  headingRow: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.sm },
  headingCopy: { flex: 1 },
  name: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 23, lineHeight: 25, textTransform: 'uppercase' },
  meta: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, lineHeight: 18 },
  topResult: { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary, fontFamily: theme.typography.displayFamily, fontSize: 10, letterSpacing: 0.4, paddingHorizontal: theme.spacing.xs, paddingVertical: theme.spacing.xxs },
  address: { color: theme.colors.text, fontSize: theme.typography.body.small, lineHeight: 18 },
  bottomRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'space-between', marginTop: 'auto' },
  rating: { color: theme.colors.acidInk, flex: 1, fontFamily: theme.typography.displayFamily, fontSize: 12, fontVariant: ['tabular-nums'], letterSpacing: 0.4 },
  selectButton: { alignItems: 'center', borderColor: theme.colors.acidBorder, borderWidth: 1, justifyContent: 'center', minHeight: 48, minWidth: 86, paddingHorizontal: theme.spacing.sm },
  selectButtonSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  selectLabel: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 13, letterSpacing: 0.5 },
  selectLabelSelected: { color: theme.colors.onPrimary },
  saveDock: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, borderWidth: 1, bottom: 0, flexDirection: 'row', gap: theme.spacing.md, left: 0, padding: theme.spacing.md, position: 'absolute', right: 0 },
  saveCopy: { flex: 1, gap: theme.spacing.xxs },
  saveEyebrow: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 11, letterSpacing: 0.8 },
  saveName: { color: theme.colors.text, fontSize: theme.typography.body.small, fontWeight: '700' },
  saveButton: { minWidth: 118 },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.55 }
});