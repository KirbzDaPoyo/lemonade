import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppTheme, useAppTheme } from '../design-system/theme';
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

type MenuAnchor = { left: number; top: number; width: number };

type V2FilterRackProps = {
  tags: PlaceTag[];
  selectedStatus: PlaceStatusFilter;
  selectedTagId: string | null;
  favoritesOnly: boolean;
  onStatusChange: (status: PlaceStatusFilter) => void;
  onTagChange: (tagId: string | null) => void;
  onFavoritesChange: (favoritesOnly: boolean) => void;
};

export function V2FilterRack({
  tags,
  selectedStatus,
  selectedTagId,
  favoritesOnly,
  onStatusChange,
  onTagChange,
  onFavoritesChange
}: V2FilterRackProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const triggerRowRef = useRef<View>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<MenuAnchor>({ left: theme.spacing.lg, top: 148, width: 320 });
  const selectedStatusLabel = statusOptions.find((option) => option.value === selectedStatus)?.label ?? 'All statuses';
  const selectedTag = tags.find((tag) => tag.id === selectedTagId);
  const hasActiveFilters = selectedStatus !== 'all' || selectedTagId !== null || favoritesOnly;
  const summary = [selectedStatus === 'all' ? 'All places' : selectedStatusLabel, favoritesOnly ? 'Favorites' : null, selectedTag?.name].filter(Boolean).join(' / ');
  const availableMenuHeight = Math.max(360, windowHeight - anchor.top - insets.bottom - theme.spacing.sm);
  const menuMaxHeight = Math.min(600, availableMenuHeight);
  const tagScrollerMaxHeight = Math.max(112, Math.min(280, menuMaxHeight - 310));

  const openMenu = () => {
    triggerRowRef.current?.measureInWindow((left, top, width, height) => {
      setAnchor({ left, top: top + height + theme.spacing.xs, width });
      setIsOpen(true);
    });
  };

  const clearFilters = () => {
    onStatusChange('all');
    onTagChange(null);
    onFavoritesChange(false);
  };

  return (
    <View style={styles.rack}>
      <View ref={triggerRowRef} style={styles.triggerRow}>
        <Pressable
          accessibilityLabel={`Filters: ${summary}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          onPress={openMenu}

          style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        >
          <View style={styles.triggerCopy}>
            <V2SectionLabel>Filters</V2SectionLabel>
            <Text numberOfLines={1} style={styles.summary}>{summary}</Text>
          </View>
          <View style={styles.filterMark}>
            <View style={styles.filterLineWide} />
            <View style={styles.filterLineMedium} />
            <View style={styles.filterLineShort} />
          </View>
        </Pressable>
        {hasActiveFilters ? (
          <Pressable
            accessibilityLabel="Clear all filters"
            accessibilityRole="button"
            onPress={clearFilters}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>CLEAR</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal animationType="fade" onRequestClose={() => setIsOpen(false)} transparent visible={isOpen}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Close filters" onPress={() => setIsOpen(false)} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={[styles.menu, { left: anchor.left, maxHeight: menuMaxHeight, top: anchor.top, width: anchor.width }]}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>FILTER MENU</Text>
              {hasActiveFilters ? (
                <Pressable accessibilityRole="button" onPress={clearFilters} style={({ pressed }) => [styles.menuClear, pressed && styles.pressed]}>
                  <Text style={styles.menuClearText}>RESET</Text>
                </Pressable>
              ) : null}
            </View>
            <V2SectionLabel>Status</V2SectionLabel>
            <View style={styles.statusGrid}>
              {statusOptions.map((option) => {
                const selected = option.value === selectedStatus;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.value}
                    onPress={() => onStatusChange(option.value)}
                    style={({ pressed }) => [styles.statusOption, selected && styles.selectedOption, pressed && styles.pressed]}
                  >
                    <Text style={[styles.optionText, selected && styles.selectedOptionText]}>{option.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityLabel="Favorites only"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: favoritesOnly }}
                onPress={() => onFavoritesChange(!favoritesOnly)}
                style={({ pressed }) => [styles.favoriteOption, favoritesOnly && styles.favoriteOptionSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.optionText, favoritesOnly && styles.favoriteOptionText]}>Favorites only</Text>
              </Pressable>
            </View>

            {tags.length > 0 ? (
              <>
                <View style={styles.tagHeadingRow}>
                  <V2SectionLabel>Tag</V2SectionLabel>
                  <Text style={styles.tagCount}>{tags.length} available</Text>
                </View>
                <ScrollView
                  contentContainerStyle={styles.tagGrid}
                  nestedScrollEnabled
                  persistentScrollbar
                  showsVerticalScrollIndicator
                  style={[styles.tagScroller, { maxHeight: tagScrollerMaxHeight }]}
                >
                  <TagButton label="All tags" selected={selectedTagId === null} onPress={() => onTagChange(null)} />
                  {tags.map((tag, index) => (
                    <TagButton key={tag.id} label={tag.name} selected={selectedTagId === tag.id} tone={index % 3} onPress={() => onTagChange(selectedTagId === tag.id ? null : tag.id)} />
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
              <Text style={styles.doneText}>VIEW RESULTS</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TagButton({ label, selected, tone = 0, onPress }: { label: string; selected: boolean; tone?: number; onPress: () => void }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toneColor = tone === 1 ? theme.colors.violet : tone === 2 ? theme.colors.cobalt : theme.colors.acidInk;
  return (
    <Pressable
      accessibilityLabel={`Filter by ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tagButton, { borderColor: toneColor }, selected && styles.selectedOption, pressed && styles.pressed]}
    >
      <Text numberOfLines={1} style={[styles.tagText, { color: selected ? theme.colors.onPrimary : toneColor }]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  rack: { zIndex: 10 },
  triggerRow: { alignItems: 'stretch', flexDirection: 'row', gap: theme.spacing.sm },
  trigger: { alignItems: 'center', backgroundColor: theme.colors.background, borderColor: theme.colors.borderStrong, borderWidth: 1, flex: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: theme.spacing.md },
  triggerCopy: { flex: 1, gap: theme.spacing.xxs },
  summary: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 16, letterSpacing: 0.5, textTransform: 'uppercase' },
  clearButton: { alignItems: 'center', borderColor: theme.colors.acidBorder, borderWidth: 1, justifyContent: 'center', minHeight: 58, minWidth: 64, paddingHorizontal: theme.spacing.sm },
  clearText: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 0.6 },
  filterMark: { alignItems: 'flex-end', gap: 4, width: 24 },
  filterLineWide: { backgroundColor: theme.colors.acidInk, height: 2, width: 24 },
  filterLineMedium: { backgroundColor: theme.colors.acidInk, height: 2, width: 16 },
  filterLineShort: { backgroundColor: theme.colors.acidInk, height: 2, width: 8 },
  modalRoot: { flex: 1 },
  menu: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, borderWidth: 1, elevation: 12, gap: theme.spacing.xs, padding: theme.spacing.sm, position: 'absolute', shadowColor: theme.colors.shadow, shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.22, shadowRadius: 18 },
  menuHeader: { alignItems: 'center', borderBottomColor: theme.colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 },
  menuTitle: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 16, letterSpacing: 0.8 },
  menuClear: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
  menuClearText: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 0.6 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statusOption: { alignItems: 'center', backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: theme.spacing.sm, width: '50%' },
  favoriteOption: { alignItems: 'center', backgroundColor: theme.colors.background, borderColor: theme.colors.pink, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: theme.spacing.sm, width: '100%' },
  favoriteOptionSelected: { backgroundColor: theme.colors.pink },
  favoriteOptionText: { color: theme.colors.onPink },
  selectedOption: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  optionText: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 13, letterSpacing: 0.4, textAlign: 'center', textTransform: 'uppercase' },
  selectedOptionText: { color: theme.colors.onPrimary },
  tagHeadingRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  tagCount: { color: theme.colors.textSubtle, fontFamily: theme.typography.displayFamily, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  tagScroller: { flexShrink: 1 },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, paddingBottom: theme.spacing.sm },
  tagButton: { alignItems: 'center', borderWidth: 1, justifyContent: 'center', minHeight: 48, minWidth: '30%', paddingHorizontal: theme.spacing.sm },
  tagText: { fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' },
  doneButton: { alignItems: 'center', backgroundColor: theme.colors.primary, justifyContent: 'center', minHeight: 48 },
  doneText: { color: theme.colors.onPrimary, fontFamily: theme.typography.displayFamily, fontSize: 14, letterSpacing: 0.6 },
  pressed: { opacity: 0.7 }
});