import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FilterBar } from '../components/FilterBar';
import { PlaceCardRow } from '../components/PlaceCardRow';
import { StatePanel } from '../components/state-panel';
import { StorageErrorBanner } from '../components/storage-error-banner';
import { TagFilterBar } from '../components/tag-filter-bar';
import { AppTheme, useAppTheme } from '../design-system/theme';
import { AppNavigation } from '../navigation/types';
import { getAssignedTagFilterOptions, matchesPlacesScreenFilters } from '../services/placeFilters';
import { usePlaces } from '../store/PlacesContext';
import type { PlaceStatusFilter } from '../types/filters';

type HomeScreenProps = { navigation: AppNavigation };

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { availableTags, isLoading, isStorageAvailable, places, storageError } = usePlaces();
  const [selectedStatus, setSelectedStatus] = useState<PlaceStatusFilter>('all');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const tagFilterOptions = useMemo(() => getAssignedTagFilterOptions(places, availableTags), [availableTags, places]);
  const selectedTag = tagFilterOptions.find((tag) => tag.id === selectedTagId) ?? null;

  useEffect(() => {
    if (selectedTagId !== null && selectedTag === null) setSelectedTagId(null);
  }, [selectedTag, selectedTagId]);

  const filteredPlaces = useMemo(() => places.filter((place) => matchesPlacesScreenFilters(place, selectedStatus, selectedTag?.name ?? null)), [places, selectedStatus, selectedTag?.name]);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        data={isLoading ? [] : filteredPlaces}
        keyExtractor={(place) => place.id}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.masthead}>
              <View style={styles.brandBlock}>
                <Text style={styles.wordmark}>PROJECT LEMONADE</Text>
                <Text style={styles.libraryMeta}>{places.length} saved {places.length === 1 ? 'place' : 'places'}</Text>
              </View>
              <View style={styles.headerActions}>
                <AppButton compact label="Account" onPress={() => navigation.navigate({ name: 'Account' })} variant="ghost" />
                <AppButton compact disabled={!isStorageAvailable} label="Add place" onPress={() => navigation.navigate({ name: 'AddPlace' })} />
              </View>
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.title}>PLACES</Text>
            <View style={styles.filters}>
              <FilterBar selectedStatus={selectedStatus} onStatusChange={setSelectedStatus} />
              <TagFilterBar tags={tagFilterOptions} selectedTagId={selectedTag?.id ?? null} onTagChange={setSelectedTagId} />
            </View>
            {storageError ? <StorageErrorBanner message={storageError} /> : null}
            {isLoading ? <StatePanel loading title="Loading saved places" /> : null}
            {!isLoading ? <Text style={styles.indexLabel}>Saved index / {filteredPlaces.length}</Text> : null}
          </View>
        }
        ListEmptyComponent={isLoading ? null : <StatePanel title="No matching places" body="Choose another tag or loosen the status filter." />}
        renderItem={({ item }) => <PlaceCardRow place={item} onPress={() => navigation.navigate({ name: 'PlaceDetail', placeId: item.id })} />}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.colors.background, flex: 1 },
  listContent: { paddingBottom: theme.spacing.huge, paddingHorizontal: theme.spacing.lg },
  headerStack: { gap: theme.spacing.xl, paddingBottom: theme.spacing.lg, paddingTop: theme.spacing.sm },
  masthead: { alignItems: 'center', borderBottomColor: theme.colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'space-between', paddingBottom: theme.spacing.sm },
  brandBlock: { flex: 1, gap: theme.spacing.xxs },
  wordmark: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 18, letterSpacing: 0.8, lineHeight: 21 },
  libraryMeta: { color: theme.colors.textMuted, fontSize: theme.typography.label.small, fontWeight: '700' },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.xs },
  title: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 72, letterSpacing: -1.6, lineHeight: 72 },
  filters: { gap: theme.spacing.lg },
  indexLabel: { color: theme.colors.textMuted, fontSize: theme.typography.label.small, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' }
});
