import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FilterBar } from '../components/FilterBar';
import { PlaceCardRow } from '../components/PlaceCardRow';
import { StorageErrorBanner } from '../components/storage-error-banner';
import { TagFilterBar } from '../components/tag-filter-bar';
import { AppNavigation } from '../navigation/types';
import {
  getAssignedTagFilterOptions,
  matchesPlacesScreenFilters
} from '../services/placeFilters';
import { usePlaces } from '../store/PlacesContext';
import { colors, spacing } from '../theme';
import type { PlaceStatusFilter } from '../types/filters';

type HomeScreenProps = {
  navigation: AppNavigation;
};

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { availableTags, isLoading, isStorageAvailable, places, storageError } = usePlaces();
  const [selectedStatus, setSelectedStatus] = useState<PlaceStatusFilter>('all');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const tagFilterOptions = useMemo(
    () => getAssignedTagFilterOptions(places, availableTags),
    [availableTags, places]
  );
  const selectedTag = tagFilterOptions.find((tag) => tag.id === selectedTagId) ?? null;

  useEffect(() => {
    if (selectedTagId !== null && selectedTag === null) {
      setSelectedTagId(null);
    }
  }, [selectedTag, selectedTagId]);

  const filteredPlaces = useMemo(
    () =>
      places.filter((place) =>
        matchesPlacesScreenFilters(place, selectedStatus, selectedTag?.name ?? null)
      ),
    [places, selectedStatus, selectedTag?.name]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Saved from Instagram</Text>
          <Text style={styles.title}>Places</Text>
        </View>
        <AppButton
          disabled={!isStorageAvailable}
          label="Add"
          onPress={() => navigation.navigate({ name: 'AddPlace' })}
          style={styles.addButton}
        />
      </View>

      <FilterBar selectedStatus={selectedStatus} onStatusChange={setSelectedStatus} />
      <TagFilterBar
        tags={tagFilterOptions}
        selectedTagId={selectedTag?.id ?? null}
        onTagChange={setSelectedTagId}
      />

      {storageError ? <StorageErrorBanner message={storageError} /> : null}

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading saved places...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={filteredPlaces}
          keyExtractor={(place) => place.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No places match these filters.</Text>
              <Text style={styles.emptyBody}>Choose another tag or loosen the status filter.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <PlaceCardRow
              place={item}
              onPress={() =>
                navigation.navigate({ name: 'PlaceDetail', placeId: item.id })
              }
            />
          )}
        />
      )}
    </View>
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
  eyebrow: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900'
  },
  addButton: {
    minHeight: 44,
    minWidth: 76
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center'
  },
  loadingText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700'
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center'
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center'
  }
});
