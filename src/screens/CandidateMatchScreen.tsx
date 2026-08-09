import { useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../components/screen-header';
import { AppNavigation } from '../navigation/types';
import type { PlaceInput } from '../repositories/savedPlaces/types';
import { resolveCandidatePlaceCategory } from '../services/classification/place-category-resolver';
import { suggestUserTags } from '../services/tags/user-tags';
import { usePlaces } from '../store/PlacesContext';
import { colors, radii, spacing } from '../theme';
import { DraftPlaceEntry, PlaceCandidate } from '../types/place';
import { categoryLabels } from '../utils/labels';

type CandidateMatchScreenProps = {
  navigation: AppNavigation;
  draft: DraftPlaceEntry;
  candidates: PlaceCandidate[];
};

type SavePlaceInput = Omit<PlaceInput, 'sourceInstagramUrl' | 'status' | 'isFavorite'>;

export function CandidateMatchScreen({
  navigation,
  draft,
  candidates
}: CandidateMatchScreenProps) {
  const { addPlace, availableTags } = usePlaces();
  const [savingKey, setSavingKey] = useState<string>();
  const saveInFlightRef = useRef(false);

  const extraction = draft.extraction;
  const availableTagNames = availableTags.map((tag) => tag.name);
  const sharedTagClues = [
    extraction?.placeName,
    extraction?.cuisineOrSpecialty,
    ...(extraction?.vibeTags ?? []),
    ...(extraction?.recommendedItems ?? [])
  ];
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

  const savePlace = (saveKey: string, place: SavePlaceInput, failureMessage: string) =>
    saveOnce(
      saveKey,
      () =>
        addPlace({
          ...place,
          sourceInstagramUrl: draft.sourceInstagramUrl,
          isFavorite: false,
          status: 'want_to_go'
        }),
      failureMessage
    );

  const handleSaveCandidate = async (candidate: PlaceCandidate) => {
    const category = resolveCandidatePlaceCategory(candidate, extraction);
    const cuisineOrSpecialty =
      candidate.cuisineOrSpecialty || extraction?.cuisineOrSpecialty || undefined;
    const suggestedTags = suggestUserTags(availableTagNames, [
      candidate.name,
      category,
      cuisineOrSpecialty,
      ...candidate.tags,
      ...sharedTagClues
    ]);

    await savePlace(
      candidate.providerPlaceId,
      {
        placeName: candidate.name,
        address: candidate.address,
        areaCity: candidate.areaCity,
        category,
        cuisineOrSpecialty,
        tags: suggestedTags,
        mapUrl: candidate.mapUrl,
        placeId: candidate.providerPlaceId
      },
      'The place could not be saved. Check the storage error.'
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader onBack={navigation.goBack} title="Match Place" />

      <FlatList
        contentContainerStyle={styles.listContent}
        data={candidates}
        keyExtractor={(candidate) => candidate.providerPlaceId}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No candidates found.</Text>
            <Text style={styles.emptyBody}>
              Go back, adjust the place name, and search again.
            </Text>
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
