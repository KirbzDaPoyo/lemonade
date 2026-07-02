import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

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
  const { places } = usePlaces();
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
            onPress={() => navigation.navigate({ name: 'PlaceDetail', placeId: item.id })}
          />
        )}
      />
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
