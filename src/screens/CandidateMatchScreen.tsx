import { useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppNavigation } from '../navigation/types';
import { normalizePlaceTags } from '../services/tags/placeTagNormalizer';
import { usePlaces } from '../store/PlacesContext';
import { colors, radii, spacing } from '../theme';
import { DraftPlaceEntry, PlaceCandidate } from '../types/place';
import { categoryLabels } from '../utils/labels';

type CandidateMatchScreenProps = {
  navigation: AppNavigation;
  draft: DraftPlaceEntry;
  candidates: PlaceCandidate[];
};

export function CandidateMatchScreen({
  navigation,
  draft,
  candidates
}: CandidateMatchScreenProps) {
  const { addPlace } = usePlaces();
  const [savingKey, setSavingKey] = useState<string>();
  const saveInFlightRef = useRef(false);

  const saveOnce = async (
    saveKey: string,
    save: () => ReturnType<typeof addPlace>,
    failureMessage: string
  ) => {
    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    setSavingKey(saveKey);

    try {
      const savedPlace = await save();

      if (savedPlace) {
        navigation.replace({ name: 'PlaceDetail', placeId: savedPlace.id });
      } else {
        Alert.alert('Save failed', failureMessage);
      }
    } finally {
      saveInFlightRef.current = false;
      setSavingKey(undefined);
    }
  };



  const handleSaveCandidate = async (candidate: PlaceCandidate) => {
    const extraction = draft.extraction;
    const cuisineOrSpecialty =
      candidate.cuisineOrSpecialty || extraction?.cuisineOrSpecialty || undefined;
    const mergedTags = normalizePlaceTags({
      placeName: candidate.name,
      category: candidate.category,
      cuisineOrSpecialty,
      signals: [
        ...candidate.tags,
        ...(extraction?.vibeTags ?? []),
        ...(extraction?.recommendedItems ?? []),
      ]
    });

    await saveOnce(
      candidate.providerPlaceId,
      () =>
        addPlace({
          placeName: candidate.name,
          address: candidate.address,
          areaCity: candidate.areaCity,
          category: candidate.category,
          cuisineOrSpecialty,
          tags: mergedTags,
          sourceInstagramUrl: draft.sourceInstagramUrl,
          mapUrl: candidate.mapUrl,
          placeId: candidate.providerPlaceId,
          status: 'want_to_go'
        }),
      'The place could not be saved. Check the storage error.'
    );
  };

  const handleSaveManually = async () => {
    const extraction = draft.extraction;
    const manualTags = normalizePlaceTags({
      placeName: extraction?.placeName || draft.suggestedPlaceName,
      category: extraction?.category || 'other',
      cuisineOrSpecialty: extraction?.cuisineOrSpecialty || undefined,
      signals: [
        ...(extraction?.vibeTags ?? []),
        ...(extraction?.recommendedItems ?? []),
      ]
    });

    await saveOnce(
      'manual',
      () =>
        addPlace({
          placeName: extraction?.placeName || draft.suggestedPlaceName,
          address: 'Address to confirm',
          areaCity: extraction?.areaOrCity || 'Area to confirm',
          category: extraction?.category || 'other',
          cuisineOrSpecialty: extraction?.cuisineOrSpecialty || undefined,
          tags: manualTags,
          sourceInstagramUrl: draft.sourceInstagramUrl,
          status: 'want_to_go'
        }),
      'The manual place could not be saved.'
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <AppButton label="Back" onPress={navigation.goBack} variant="ghost" />
        <Text style={styles.title}>Match Place</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.draftBox}>
        <Text style={styles.draftLabel}>Draft from Instagram</Text>
        <Text style={styles.draftTitle}>{draft.suggestedPlaceName}</Text>
        <Text numberOfLines={2} style={styles.draftUrl}>
          {draft.sourceInstagramUrl}
        </Text>
        {draft.extraction ? (
          <View style={styles.extractionSummary}>
            <Text style={styles.extractionSummaryText}>
              {draft.extraction.category
                ? categoryLabels[draft.extraction.category]
                : 'Place'} - {draft.extraction.areaOrCity || 'Area to confirm'}
            </Text>
            <Text style={styles.extractionSummaryText}>
              {draft.extraction.cuisineOrSpecialty || 'Specialty to confirm'}
            </Text>
          </View>
        ) : null}
      </View>

      <AppButton
        disabled={Boolean(savingKey)}
        label={savingKey === 'manual' ? 'Saving...' : 'Save Manually'}
        onPress={handleSaveManually}
        variant="secondary"
      />

      <FlatList
        contentContainerStyle={styles.listContent}
        data={candidates}
        keyExtractor={(candidate) => candidate.providerPlaceId}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No candidates found.</Text>
            <Text style={styles.emptyBody}>Save manually or go back and adjust the place name.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <CandidateRow
            candidate={item}
            disabled={Boolean(savingKey)}
            isSaving={savingKey === item.providerPlaceId}
            onPress={() => handleSaveCandidate(item)}
          />
        )}
      />
    </View>
  );
}

function CandidateRow({
  candidate,
  disabled,
  isSaving,
  onPress
}: {
  candidate: PlaceCandidate;
  disabled: boolean;
  isSaving: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.candidateCard,
        pressed && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      <View style={styles.candidateHeader}>
        <View style={styles.candidateText}>
          <Text style={styles.candidateName}>{candidate.name}</Text>
          <Text style={styles.candidateMeta}>
            {categoryLabels[candidate.category]} - {candidate.areaCity}
          </Text>
        </View>
        <Text style={styles.selectText}>{isSaving ? 'Saving...' : 'Select'}</Text>
      </View>
      <Text style={styles.address}>{candidate.address}</Text>
      {candidate.cuisineOrSpecialty ? (
        <Text style={styles.specialty}>{candidate.cuisineOrSpecialty}</Text>
      ) : null}
      {candidate.rating ? (
        <Text style={styles.rating}>
          Rating {candidate.rating.toFixed(1)}
          {candidate.userRatingCount ? ` (${candidate.userRatingCount})` : ''}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.lg,
    padding: spacing.lg
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900'
  },
  headerSpacer: {
    width: 72
  },
  draftBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.lg
  },
  draftLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  draftTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900'
  },
  draftUrl: {
    color: colors.muted,
    fontSize: 13
  },
  extractionSummary: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm
  },
  extractionSummaryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl
  },
  candidateCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  pressed: {
    opacity: 0.82
  },
  disabled: {
    opacity: 0.55
  },
  candidateHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between'
  },
  candidateText: {
    flex: 1,
    gap: spacing.xs
  },
  candidateName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  candidateMeta: {
    color: colors.muted,
    fontSize: 14
  },
  selectText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900'
  },
  address: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20
  },
  specialty: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800'
  },
  rating: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700'
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 15
  }
});

