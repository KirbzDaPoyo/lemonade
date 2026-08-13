import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';
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
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel =
    statusOptions.find((option) => option.value === selectedStatus)?.label ?? 'Status';

  const selectStatus = (status: PlaceStatusFilter) => {
    onStatusChange(status);
    setIsOpen(false);
  };

  return (
    <View style={styles.dropdown}>
      <Text style={styles.dropdownLabel}>Status filter</Text>
      <Pressable
        accessibilityLabel={`Status: ${selectedLabel}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((current) => !current)}
        style={({ pressed }) => [styles.dropdownButton, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={styles.dropdownValue}>{selectedLabel}</Text>
        <Text style={styles.toggleLabel}>{isOpen ? 'CLOSE' : 'OPEN'}</Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.menu}>
          {statusOptions.map((option, index) => {
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
                  index < statusOptions.length - 1 && styles.menuDivider,
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

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    dropdown: { gap: theme.spacing.xs },
    dropdownLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.label.small,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase'
    },
    dropdownButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderStrong,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingHorizontal: theme.spacing.lg
    },
    dropdownValue: {
      color: theme.colors.text,
      flex: 1,
      fontSize: theme.typography.body.medium,
      fontWeight: '800'
    },
    toggleLabel: {
      color: theme.colors.cobalt,
      fontSize: theme.typography.label.small,
      fontWeight: '900',
      letterSpacing: 1
    },
    menu: {
      backgroundColor: theme.colors.surfaceElevated,
      borderColor: theme.colors.borderStrong,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      overflow: 'hidden'
    },
    menuItem: {
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: theme.spacing.lg
    },
    menuDivider: {
      borderBottomColor: theme.colors.border,
      borderBottomWidth: 1
    },
    selectedMenuItem: { backgroundColor: theme.colors.primarySoft },
    menuItemText: {
      color: theme.colors.text,
      fontSize: theme.typography.body.medium,
      fontWeight: '700'
    },
    selectedMenuItemText: { color: theme.colors.text, fontWeight: '900' },
    pressed: { opacity: 0.72 }
  });
