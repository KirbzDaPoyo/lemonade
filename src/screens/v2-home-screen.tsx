import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { StatePanel } from '../components/state-panel';
import { StorageErrorBanner } from '../components/storage-error-banner';
import { V2FilterRack } from '../components/v2-filter-rack';
import { EnergySlash } from '../components/v2-marks';
import { V2PlaceRow } from '../components/v2-place-row';
import { AppTheme, useAppTheme } from '../design-system/theme';
import type { AppNavigation } from '../navigation/types';
import { analytics } from '../observability/analytics';
import { getAssignedTagFilterOptions, matchesPlacesScreenFilters } from '../services/placeFilters';
import { usePlaces } from '../store/PlacesContext';
import type { PlaceStatusFilter } from '../types/filters';

type V2HomeScreenProps = { navigation: AppNavigation };

export function V2HomeScreen({ navigation }: V2HomeScreenProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { availableTags, isLoading, isStorageAvailable, places, retryStorage, storageError } = usePlaces();
  const [selectedStatus, setSelectedStatus] = useState<PlaceStatusFilter>('all');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const tagFilterOptions = useMemo(() => getAssignedTagFilterOptions(places, availableTags), [availableTags, places]);
  const selectedTag = tagFilterOptions.find((tag) => tag.id === selectedTagId) ?? null;
  const isInitialLoading = isLoading && places.length === 0;

  useEffect(() => {
    if (selectedTagId !== null && selectedTag === null) setSelectedTagId(null);
  }, [selectedTag, selectedTagId]);

  const filteredPlaces = useMemo(
    () => places.filter((place) => matchesPlacesScreenFilters(place, selectedStatus, selectedTag?.name ?? null, favoritesOnly)),
    [favoritesOnly, places, selectedStatus, selectedTag?.name]
  );

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        data={filteredPlaces}
        keyExtractor={(place) => place.id}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.masthead}>
              <View>
                <Text style={styles.wordmark}>LEMONADE</Text>
                <Text style={styles.libraryMeta}>{places.length} SAVED</Text>
              </View>
              <Pressable
                accessibilityLabel="Account"
                accessibilityRole="button"
                onPress={() => navigation.navigate({ name: 'Account' })}
                style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}
              >
                <View style={styles.accountHead} />
                <View style={styles.accountBody} />
              </Pressable>
            </View>
            <View style={styles.titleBand}>
              <View style={styles.titleCopy}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.title}>SAVED PLACES</Text>
                <Text style={styles.indexMeta}>PRIVATE INDEX / {places.length}</Text>
              </View>
              <Pressable
                accessibilityLabel="Add place"
                accessibilityRole="button"
                accessibilityState={{ disabled: !isStorageAvailable }}
                disabled={!isStorageAvailable}
                onPress={() => {
                  analytics.manualAddOpened();
                  navigation.navigate({ name: 'AddPlace' });
                }}
                style={({ pressed }) => [styles.addButton, !isStorageAvailable && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.addPlus}>+</Text>
                <Text style={styles.addLabel}>ADD PLACE</Text>
              </Pressable>
            </View>
            <V2FilterRack
              favoritesOnly={favoritesOnly}
              onFavoritesChange={setFavoritesOnly}
              onStatusChange={setSelectedStatus}
              onTagChange={setSelectedTagId}
              selectedStatus={selectedStatus}
              selectedTagId={selectedTag?.id ?? null}
              tags={tagFilterOptions}
            />
            {storageError ? <StorageErrorBanner message={storageError} onRetry={retryStorage} /> : null}
            {isInitialLoading ? <StatePanel loading title="Loading saved places" /> : null}
            {!isInitialLoading ? <Text style={styles.resultsLabel}>Saved index / {filteredPlaces.length}</Text> : null}
          </View>
        }
        ListEmptyComponent={isInitialLoading ? null : <StatePanel title="No matching places" body="Choose another tag or loosen the status filter." />}
        ListFooterComponent={<View style={styles.footerEnergy}><EnergySlash /></View>}
        renderItem={({ item, index }) => (
          <V2PlaceRow
            index={index + 1}
            onPress={() => {
              analytics.placeOpened(item.status);
              navigation.navigate({ name: 'PlaceDetail', placeId: item.id });
            }}
            place={item}
          />
        )}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.colors.background, flex: 1 },
  listContent: { paddingBottom: theme.spacing.huge, paddingHorizontal: theme.spacing.lg },
  headerStack: { gap: theme.spacing.lg, paddingBottom: theme.spacing.xs },
  masthead: { alignItems: 'center', borderBottomColor: theme.colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58 },
  wordmark: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 17, fontStyle: 'italic', letterSpacing: 0.8, lineHeight: 20 },
  libraryMeta: { color: theme.colors.textMuted, fontFamily: theme.typography.displayFamily, fontSize: 11, letterSpacing: 0.8 },
  accountButton: { alignItems: 'center', borderColor: theme.colors.acidBorder, borderWidth: 1, height: 48, justifyContent: 'center', position: 'relative', width: 48 },
  accountHead: { borderColor: theme.colors.acidInk, borderRadius: 5, borderWidth: 1, height: 9, position: 'absolute', top: 10, width: 9 },
  accountBody: { borderColor: theme.colors.acidInk, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, bottom: 8, height: 11, position: 'absolute', width: 18 },
  titleBand: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'space-between' },
  titleCopy: { flex: 1, gap: theme.spacing.xs },
  title: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 48, letterSpacing: -0.8, lineHeight: 50 },
  indexMeta: { color: theme.colors.textMuted, fontFamily: theme.typography.displayFamily, fontSize: 11, letterSpacing: 1 },
  addButton: { alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radii.xs, height: 64, justifyContent: 'center', width: 70 },
  addPlus: { color: theme.colors.onPrimary, fontSize: 36, fontWeight: '300', lineHeight: 36 },
  addLabel: { color: theme.colors.onPrimary, fontFamily: theme.typography.displayFamily, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  disabled: { backgroundColor: theme.colors.surfaceMuted, opacity: 0.75 },
  pressed: { opacity: 0.68 },
  resultsLabel: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  footerEnergy: { alignItems: 'flex-start', minHeight: 92, overflow: 'hidden', paddingTop: theme.spacing.xl }
});