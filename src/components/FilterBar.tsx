import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';
import type { PlaceStatusFilter } from '../types/filters';
import { favoriteLabel, statusLabels } from '../utils/labels';

type FilterBarProps = {
  selectedStatus: PlaceStatusFilter;
  onStatusChange: (status: PlaceStatusFilter) => void;
};

const statusOptions: Array<{ value: PlaceStatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'want_to_go', label: statusLabels.want_to_go },
  { value: 'visited', label: statusLabels.visited },
  { value: 'favorite', label: favoriteLabel },
  { value: 'skipped', label: statusLabels.skipped }
];

export function FilterBar({ selectedStatus, onStatusChange }: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel =
    statusOptions.find((option) => option.value === selectedStatus)?.label ?? 'Status';

  const selectStatus = (status: PlaceStatusFilter) => {
    onStatusChange(status);
    setIsOpen(false);
  };

  return (
    <View style={styles.dropdown}>
      <Text style={styles.dropdownLabel}>Status</Text>
      <Pressable
        accessibilityLabel={`Status: ${selectedLabel}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((current) => !current)}
        style={({ pressed }) => [styles.dropdownButton, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={styles.dropdownValue}>
          {selectedLabel}
        </Text>
        <Text style={styles.chevron}>{isOpen ? '^' : 'v'}</Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.menu}>
          {statusOptions.map((option) => {
            const selected = option.value === selectedStatus;

            return (
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => selectStatus(option.value)}
                style={({ pressed }) => [
                  styles.menuItem,
                  selected && styles.selectedMenuItem,
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.menuItemText, selected && styles.selectedMenuItemText]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    gap: spacing.xs
  },
  dropdownLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  dropdownButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  dropdownValue: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800'
  },
  chevron: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: spacing.md
  },
  menu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden'
  },
  menuItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  selectedMenuItem: {
    backgroundColor: colors.surfaceMuted
  },
  menuItemText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700'
  },
  selectedMenuItemText: {
    color: colors.primary,
    fontWeight: '900'
  },
  pressed: {
    opacity: 0.82
  }
});
