import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlaceFilterKey, PlaceFilterOption } from '../services/placeFilters';
import { colors, radii, spacing } from '../theme';
import { PlaceStatus } from '../types/place';
import { statusLabels } from '../utils/labels';

type FilterBarProps = {
  selectedStatus: PlaceStatus | 'all';
  selectedPlaceFilter: PlaceFilterKey;
  placeFilterOptions: PlaceFilterOption[];
  onStatusChange: (status: PlaceStatus | 'all') => void;
  onPlaceFilterChange: (filter: PlaceFilterKey) => void;
};

type DropdownOption<T extends string> = {
  value: T;
  label: string;
};

const statusOptions: Array<DropdownOption<PlaceStatus | 'all'>> = [
  { value: 'all', label: 'All status' },
  { value: 'want_to_go', label: statusLabels.want_to_go },
  { value: 'visited', label: statusLabels.visited },
  { value: 'favorite', label: statusLabels.favorite },
  { value: 'skip', label: statusLabels.skip }
];

export function FilterBar({
  selectedStatus,
  selectedPlaceFilter,
  placeFilterOptions,
  onStatusChange,
  onPlaceFilterChange
}: FilterBarProps) {
  const [openMenu, setOpenMenu] = useState<'status' | 'place' | null>(null);
  const placeOptions = placeFilterOptions.map((filter) => ({
    value: filter.key,
    label: filter.label
  }));

  return (
    <View style={styles.container}>
      <Dropdown
        label="Status"
        open={openMenu === 'status'}
        options={statusOptions}
        selectedValue={selectedStatus}
        onToggle={() => setOpenMenu((current) => (current === 'status' ? null : 'status'))}
        onSelect={(status) => {
          onStatusChange(status);
          setOpenMenu(null);
        }}
      />
      <Dropdown
        label="Place"
        open={openMenu === 'place'}
        options={placeOptions}
        selectedValue={selectedPlaceFilter}
        onToggle={() => setOpenMenu((current) => (current === 'place' ? null : 'place'))}
        onSelect={(filter) => {
          onPlaceFilterChange(filter);
          setOpenMenu(null);
        }}
      />
    </View>
  );
}

function Dropdown<T extends string>({
  label,
  open,
  options,
  selectedValue,
  onToggle,
  onSelect
}: {
  label: string;
  open: boolean;
  options: Array<DropdownOption<T>>;
  selectedValue: T;
  onToggle: () => void;
  onSelect: (value: T) => void;
}) {
  const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? label;

  return (
    <View style={styles.dropdown}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}: ${selectedLabel}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.dropdownButton, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={styles.dropdownValue}>
          {selectedLabel}
        </Text>
        <Text style={styles.chevron}>{open ? '^' : 'v'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          {options.map((option) => {
            const selected = option.value === selectedValue;

            return (
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => onSelect(option.value)}
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
  container: {
    gap: spacing.md
  },
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
    minHeight: 42,
    justifyContent: 'center',
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
