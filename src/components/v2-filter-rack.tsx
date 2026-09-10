import { useMemo, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppTheme, useAppTheme } from '../design-system/theme';
import { useReducedMotion } from '../design-system/use-reduced-motion';
import { LibraryDensity, LibrarySort, LibraryView, sortLabels } from '../services/library-view';
import type { PlaceStatusFilter } from '../types/filters';
import type { PlaceTag } from '../types/place';
import { statusLabels } from '../utils/labels';
import { V2SectionLabel } from './v2-layout';

const statusOptions: Array<{ value: PlaceStatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'want_to_go', label: statusLabels.want_to_go },
  { value: 'visited', label: statusLabels.visited },
  { value: 'skipped', label: statusLabels.skipped }
];

type Option = { value: string; label: string };
type V2FilterRackProps = {
  view: LibraryView;
  tags: PlaceTag[];
  categories: Option[];
  areas: Option[];
  onFilterChange: (changes: Partial<LibraryView>, type: 'status' | 'favorite' | 'tag' | 'category' | 'area') => void;
  onClearFilters: () => void;
  onSortChange: (sort: LibrarySort) => void;
  onDensityChange: (density: LibraryDensity) => void;
};

export function V2FilterRack({ view, tags, categories, areas, onFilterChange, onClearFilters, onSortChange, onDensityChange }: V2FilterRackProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [menu, setMenu] = useState<'filters' | 'sort' | null>(null);
  const count = [view.status !== 'all', view.favoritesOnly, view.tag !== null, view.category !== null, view.area !== null].filter(Boolean).length;
  const openMenu = (next: 'filters' | 'sort') => { Keyboard.dismiss(); setMenu(next); };

  return (
    <View style={styles.rack}>
      <View style={styles.triggerRow}>
        <Pressable accessibilityLabel={`Filters: ${count} active`} accessibilityRole="button" accessibilityState={{ expanded: menu === 'filters' }} onPress={() => openMenu('filters')} style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
          <Text style={styles.summary}>Filters{count ? ` (${count})` : ''}</Text>
          <View style={styles.filterMark}><View style={styles.filterLineWide} /><View style={styles.filterLineMedium} /><View style={styles.filterLineShort} /></View>
        </Pressable>
        <Pressable accessibilityLabel={`Sort: ${sortLabels[view.sort]}`} accessibilityRole="button" accessibilityState={{ expanded: menu === 'sort' }} onPress={() => openMenu('sort')} style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
          <Text style={styles.summary}>{sortLabels[view.sort]}</Text>
        </Pressable>
        <Pressable accessibilityLabel={`Compact rows, ${view.density === 'compact' ? 'on' : 'off'}`} accessibilityRole="switch" accessibilityState={{ checked: view.density === 'compact' }} onPress={() => onDensityChange(view.density === 'compact' ? 'comfortable' : 'compact')} style={({ pressed }) => [styles.densityButton, view.density === 'compact' && styles.selectedOption, pressed && styles.pressed]}>
          <Text style={[styles.optionText, view.density === 'compact' && styles.selectedOptionText]}>Compact</Text>
        </Pressable>
      </View>
      <Modal animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={() => setMenu(null)} transparent visible={menu !== null}>
        <View style={[styles.modalRoot, { paddingTop: insets.top + theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.md }]}>
          <Pressable accessibilityLabel="Close library controls" accessibilityRole="button" onPress={() => setMenu(null)} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={[styles.menu, { maxHeight: Math.max(0, height - insets.top - insets.bottom - theme.spacing.md * 2) }]}>
            <View style={styles.menuHeader}>
              <Text accessibilityRole="header" style={styles.menuTitle}>{menu === 'filters' ? 'FILTERS' : 'SORT PLACES'}</Text>
              {menu === 'filters' && count > 0 ? <Pressable accessibilityLabel="Clear all filters" accessibilityRole="button" onPress={onClearFilters} style={styles.menuClear}><Text style={styles.menuClearText}>CLEAR</Text></Pressable> : null}
              <Pressable accessibilityLabel="Close library controls" accessibilityRole="button" onPress={() => setMenu(null)} style={styles.menuClear}><Text style={styles.menuClearText}>DONE</Text></Pressable>
            </View>
            <ScrollView style={styles.scroller} contentContainerStyle={styles.menuContent} keyboardShouldPersistTaps="handled">
              {menu === 'sort' ? (Object.keys(sortLabels) as LibrarySort[]).map(sort => <OptionButton key={sort} label={sortLabels[sort]} selected={view.sort === sort} onPress={() => { onSortChange(sort); setMenu(null); }} />) : <>
                <V2SectionLabel>Status</V2SectionLabel>
                <View style={styles.optionGrid}>{statusOptions.map(option => <OptionButton key={option.value} label={option.label} selected={view.status === option.value} onPress={() => onFilterChange({ status: option.value }, 'status')} />)}</View>
                <Pressable accessibilityLabel="Favorites only" accessibilityRole="checkbox" accessibilityState={{ checked: view.favoritesOnly }} onPress={() => onFilterChange({ favoritesOnly: !view.favoritesOnly }, 'favorite')} style={[styles.favoriteOption, view.favoritesOnly && styles.favoriteOptionSelected]}>
                  <Text style={[styles.optionText, view.favoritesOnly && styles.favoriteOptionText]}>Favorites only</Text>
                </Pressable>
                <V2SectionLabel>Tag</V2SectionLabel>
                <View style={styles.optionGrid}>
                  <OptionButton label="All tags" selected={view.tag === null} onPress={() => onFilterChange({ tag: null }, 'tag')} />
                  {tags.map(tag => <OptionButton key={tag.id} label={tag.name} selected={view.tag === tag.name} onPress={() => onFilterChange({ tag: tag.name }, 'tag')} />)}
                </View>
                <V2SectionLabel>Category</V2SectionLabel>
                <View style={styles.optionGrid}>
                  <OptionButton label="All categories" selected={view.category === null} onPress={() => onFilterChange({ category: null }, 'category')} />
                  {categories.map(option => <OptionButton key={option.value} label={option.label} selected={view.category === option.value} onPress={() => onFilterChange({ category: option.value }, 'category')} />)}
                </View>
                <V2SectionLabel>Area or city</V2SectionLabel>
                <View style={styles.optionGrid}>
                  <OptionButton label="All areas" selected={view.area === null} onPress={() => onFilterChange({ area: null }, 'area')} />
                  {areas.map(option => <OptionButton key={option.value} label={option.label} selected={view.area === option.value} onPress={() => onFilterChange({ area: option.value }, 'area')} />)}
                </View>
              </>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function OptionButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.selectedOption, pressed && styles.pressed]}>
    <Text style={[styles.optionText, selected && styles.selectedOptionText]}>{label}</Text>
  </Pressable>;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  rack: { gap: theme.spacing.sm },
  triggerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  trigger: { alignItems: 'center', borderColor: theme.colors.borderStrong, borderWidth: 1, flexGrow: 1, flexBasis: 120, flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'space-between', minHeight: 48, padding: theme.spacing.sm },
  summary: { flexShrink: 1, color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 16, textTransform: 'uppercase' },
  densityButton: { borderColor: theme.colors.borderStrong, borderWidth: 1, justifyContent: 'center', minHeight: 48, padding: theme.spacing.sm },
  filterMark: { alignItems: 'flex-end', gap: 4, width: 20 },
  filterLineWide: { backgroundColor: theme.colors.acidInk, height: 2, width: 20 },
  filterLineMedium: { backgroundColor: theme.colors.acidInk, height: 2, width: 14 },
  filterLineShort: { backgroundColor: theme.colors.acidInk, height: 2, width: 8 },
  modalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: theme.spacing.lg, backgroundColor: theme.colors.overlay },
  menu: { width: '100%', maxWidth: 520, backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, borderWidth: 1, padding: theme.spacing.md, flexShrink: 1 },
  menuHeader: { alignItems: 'center', borderBottomColor: theme.colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: theme.spacing.sm, minHeight: 48 },
  menuTitle: { flex: 1, color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 20 },
  menuClear: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
  menuClearText: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 14 },
  scroller: { flexShrink: 1 },
  menuContent: { gap: theme.spacing.sm, paddingVertical: theme.spacing.md },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
  option: { borderColor: theme.colors.borderStrong, borderWidth: 1, justifyContent: 'center', minHeight: 48, maxWidth: '100%', padding: theme.spacing.sm },
  optionText: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 15, textTransform: 'uppercase' },
  selectedOption: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  selectedOptionText: { color: theme.colors.onPrimary },
  favoriteOption: { alignItems: 'center', borderColor: theme.colors.pink, borderWidth: 1, justifyContent: 'center', minHeight: 48, padding: theme.spacing.sm, marginBottom: theme.spacing.md },
  favoriteOptionSelected: { backgroundColor: theme.colors.pink },
  favoriteOptionText: { color: theme.colors.onPink },
  pressed: { opacity: 0.7 }
});
