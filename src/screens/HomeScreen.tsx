import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FilterBar } from '../components/FilterBar';
import { PlaceCardRow } from '../components/PlaceCardRow';
import { StorageErrorBanner } from '../components/storage-error-banner';
import { AppNavigation } from '../navigation/types';
import { findPlaceFilterOption, getPlaceFilterOptions, PlaceFilterKey } from '../services/placeFilters';
import { usePlaces } from '../store/PlacesContext';
import { colors, spacing } from '../theme';
import { PlaceStatus } from '../types/place';

type HomeScreenProps = {
  navigation: AppNavigation;
};

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { isLoading, isStorageAvailable, places, storageError } = usePlaces();
  const [selectedStatus, setSelectedStatus] = useState<PlaceStatus | 'all'>('all');
  const [selectedPlaceFilter, setSelectedPlaceFilter] = useState<PlaceFilterKey>('all');

  const placeFilterOptions = useMemo(() => getPlaceFilterOptions(places), [places]);
  const activePlaceFilter = placeFilterOptions.some(
    (option) => option.key === selectedPlaceFilter
  )
    ? selectedPlaceFilter
    : 'all';

  useEffect(() => {
    if (activePlaceFilter !== selectedPlaceFilter) {
      setSelectedPlaceFilter(activePlaceFilter);
    }
  }, [activePlaceFilter, selectedPlaceFilter]);

  const filteredPlaces = useMemo(
    () =>
      places.filter((place) => {
        const matchesStatus =
          selectedStatus === 'all' || place.status === selectedStatus;
        const placeFilter = findPlaceFilterOption(placeFilterOptions, activePlaceFilter);
        const matchesPlaceFilter = placeFilter.matchesPlace(place);

        return matchesStatus && matchesPlaceFilter;
      }),
    [activePlaceFilter, placeFilterOptions, places, selectedStatus]
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

      <FilterBar
        selectedStatus={selectedStatus}
        selectedPlaceFilter={activePlaceFilter}
        placeFilterOptions={placeFilterOptions}
        onStatusChange={setSelectedStatus}
        onPlaceFilterChange={setSelectedPlaceFilter}
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
              <Text style={styles.emptyBody}>Add a reel URL or loosen the filters.</Text>
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
