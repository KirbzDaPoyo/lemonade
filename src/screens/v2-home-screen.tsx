import { useAuth } from '@clerk/expo';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, TextInput, StyleSheet, Text, View } from 'react-native';

import { useInbox } from '../store/inbox-context';
import { V2Button } from '../components/v2-controls';
import { StatePanel } from '../components/state-panel';
import { StorageErrorBanner } from '../components/storage-error-banner';
import { V2FilterRack } from '../components/v2-filter-rack';
import { EnergySlash } from '../components/v2-marks';
import { V2PlaceRow } from '../components/v2-place-row';
import { AppTheme, useAppTheme } from '../design-system/theme';
import type { AppNavigation } from '../navigation/types';
import { analytics } from '../observability/analytics';
import { getAssignedTagFilterOptions } from '../services/placeFilters';
import { usePlaces } from '../store/PlacesContext';
import { clearLibraryFilters, defaultLibraryView, libraryOptions, LibraryView, selectLibraryPlaces } from '../services/library-view';
import { useLibraryPreferences } from '../services/use-library-preferences';
import { getUserTagKey } from '../services/tags/user-tags';

type V2HomeScreenProps = { navigation: AppNavigation };

export function V2HomeScreen({ navigation }: V2HomeScreenProps) {
  const { items: inboxItems } = useInbox();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { availableTags, isLoading, isStorageAvailable, places, retryStorage, storageError } = usePlaces();
  const { userId } = useAuth();
  const [preferences, updatePreferences] = useLibraryPreferences(userId);
  const [sessionView, setSessionView] = useState<LibraryView>(defaultLibraryView);
  const searchStarted = useRef(false);
  const tagFilterOptions = useMemo(() => getAssignedTagFilterOptions(places, availableTags), [availableTags, places]);
  const categories = useMemo(() => libraryOptions(places, 'category'), [places]);
  const areas = useMemo(() => libraryOptions(places, 'areaCity'), [places]);
  const view = useMemo(() => ({ ...sessionView, ...preferences }), [sessionView, preferences]);
  const isInitialLoading = isLoading && places.length === 0;

  useEffect(() => {
    setSessionView(defaultLibraryView);
    searchStarted.current = false;
  }, [userId]);
  useEffect(() => {
    if (isLoading) return;
    setSessionView(current => {
      const tag = tagFilterOptions.find(tag => current.tag !== null && getUserTagKey(tag.name) === getUserTagKey(current.tag))?.name ?? null;
      const category = categories.some(option => option.value === current.category) ? current.category : null;
      const area = areas.some(option => option.value === current.area) ? current.area : null;
      return tag === current.tag && category === current.category && area === current.area ? current : { ...current, tag, category, area };
    });
  }, [areas, categories, isLoading, tagFilterOptions]);
  const filteredPlaces = useMemo(() => selectLibraryPlaces(places, view), [places, view]);
  const clearFilters = () => { setSessionView(clearLibraryFilters); analytics.libraryFiltersCleared(); };
  const changeQuery = (query: string) => {
    if (query.trim() && !searchStarted.current) { searchStarted.current = true; analytics.librarySearchStarted(); }
    setSessionView(current => ({ ...current, query }));
  };

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
            <V2Button compact variant="ghost" label={`INBOX / ${inboxItems.length}`} onPress={() => navigation.navigate({ name: 'Inbox' })} />
            <View style={styles.searchRow}>
              <TextInput accessibilityLabel="Search saved places" placeholder="Search saved places" placeholderTextColor={theme.colors.textMuted} value={view.query} onChangeText={changeQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={Keyboard.dismiss} style={styles.searchInput} />
              {view.query ? <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => changeQuery('')} style={styles.clearSearch}><Text style={styles.clearText}>CLEAR</Text></Pressable> : null}
            </View>
            <V2FilterRack
              view={view} tags={tagFilterOptions} categories={categories} areas={areas}
              onFilterChange={(changes, type) => { setSessionView(current => ({ ...current, ...changes })); analytics.libraryFilterChanged(type); }}
              onClearFilters={clearFilters}
              onSortChange={sort => { updatePreferences({ ...preferences, sort }); analytics.librarySortChanged(sort); }}
              onDensityChange={density => { updatePreferences({ ...preferences, density }); analytics.libraryDensityChanged(density); }}
            />
            {storageError ? <StorageErrorBanner message={storageError} onRetry={retryStorage} /> : null}
            {isInitialLoading ? <StatePanel loading title="Loading saved places" /> : null}
            {!isInitialLoading ? <Text style={styles.resultsLabel}>{filteredPlaces.length} of {places.length} places</Text> : null}
          </View>
        }
        ListEmptyComponent={isInitialLoading || storageError ? null : places.length === 0 ? <StatePanel title="Your library is empty" body="Use Add place to save your first Instagram discovery." /> : <View><StatePanel title="No matching places" body="Try another search or clear your filters." />{view.query ? <Pressable accessibilityRole="button" onPress={() => changeQuery('')} style={styles.clearSearch}><Text style={styles.clearText}>Clear search</Text></Pressable> : null}<Pressable accessibilityRole="button" onPress={clearFilters} style={styles.clearSearch}><Text style={styles.clearText}>Clear filters</Text></Pressable></View>}
        ListFooterComponent={<View style={styles.footerEnergy}><EnergySlash /></View>}
        renderItem={({ item, index }) => (
          <V2PlaceRow
            density={view.density}
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
  searchRow: { flexDirection: 'row', borderWidth: 1, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.input, alignItems: 'center' },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, padding: theme.spacing.md, color: theme.colors.text, fontSize: theme.typography.body.medium },
  clearSearch: { minHeight: 48, minWidth: 48, justifyContent: 'center', padding: theme.spacing.sm },
  clearText: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 14 },
  screen: { backgroundColor: theme.colors.background, flex: 1 },
  listContent: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: theme.spacing.huge, paddingHorizontal: theme.spacing.lg },
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