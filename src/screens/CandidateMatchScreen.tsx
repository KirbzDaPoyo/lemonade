import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppNavigation } from '../navigation/types';
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

  const handleSaveCandidate = (candidate: PlaceCandidate) => {
    const savedPlace = addPlace({
      placeName: candidate.name,
      address: candidate.address,
      areaCity: candidate.areaCity,
      category: candidate.category,
      cuisineOrSpecialty: candidate.cuisineOrSpecialty,
      tags: candidate.tags,
      notes: draft.notes,
      sourceInstagramUrl: draft.sourceInstagramUrl,
      mapUrl: candidate.mapUrl,
      placeId: candidate.providerPlaceId,
      status: 'want_to_go'
    });

    navigation.navigate({ name: 'PlaceDetail', placeId: savedPlace.id });
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
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={candidates}
        keyExtractor={(candidate) => candidate.providerPlaceId}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No candidates found.</Text>
            <Text style={styles.emptyBody}>Go back and adjust the place name.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <CandidateRow candidate={item} onPress={() => handleSaveCandidate(item)} />
        )}
      />
    </View>
  );
}

function CandidateRow({
  candidate,
  onPress
}: {
  candidate: PlaceCandidate;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.candidateCard, pressed && styles.pressed]}
    >
      <View style={styles.candidateHeader}>
        <View style={styles.candidateText}>
          <Text style={styles.candidateName}>{candidate.name}</Text>
          <Text style={styles.candidateMeta}>
            {categoryLabels[candidate.category]} · {candidate.areaCity}
          </Text>
        </View>
        <Text style={styles.selectText}>Select</Text>
      </View>
      <Text style={styles.address}>{candidate.address}</Text>
      {candidate.cuisineOrSpecialty ? (
        <Text style={styles.specialty}>{candidate.cuisineOrSpecialty}</Text>
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
