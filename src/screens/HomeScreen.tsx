import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FilterBar } from '../components/FilterBar';
import { PlaceCardRow } from '../components/PlaceCardRow';
import { AppNavigation } from '../navigation/types';
import { usePlaces } from '../store/PlacesContext';
import { colors, spacing } from '../theme';
import { PlaceCategory, PlaceStatus } from '../types/place';

type HomeScreenProps = {
  navigation: AppNavigation;
};

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { isLoading, places, storageError } = usePlaces();
  const [selectedStatus, setSelectedStatus] = useState<PlaceStatus | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | 'all'>('all');

  const filteredPlaces = useMemo(
    () =>
      places.filter((place) => {
        const matchesStatus =
          selectedStatus === 'all' || place.status === selectedStatus;
        const matchesCategory =
          selectedCategory === 'all' || place.category === selectedCategory;

        return matchesStatus && matchesCategory;
      }),
    [places, selectedCategory, selectedStatus]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Saved from Instagram</Text>
          <Text style={styles.title}>Places</Text>
        </View>
        <AppButton
          label="Add"
          onPress={() => navigation.navigate({ name: 'AddPlace' })}
          style={styles.addButton}
        />
      </View>

      <FilterBar
        selectedCategory={selectedCategory}
        selectedStatus={selectedStatus}
        onCategoryChange={setSelectedCategory}
        onStatusChange={setSelectedStatus}
      />

      {storageError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Storage issue</Text>
          <Text style={styles.errorBody}>{storageError}</Text>
        </View>
      ) : null}

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
  errorBanner: {
    backgroundColor: '#fff3f0',
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900'
  },
  errorBody: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
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
