import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';
import { PlaceCategory, PlaceStatus } from '../types/place';
import { categoryLabels, statusLabels } from '../utils/labels';

type FilterBarProps = {
  selectedStatus: PlaceStatus | 'all';
  selectedCategory: PlaceCategory | 'all';
  onStatusChange: (status: PlaceStatus | 'all') => void;
  onCategoryChange: (category: PlaceCategory | 'all') => void;
};

const statusOptions: Array<PlaceStatus | 'all'> = [
  'all',
  'want_to_go',
  'visited',
  'favorite',
  'skip'
];

const categoryOptions: Array<PlaceCategory | 'all'> = [
  'all',
  'cafe',
  'restaurant',
  'street_food',
  'dessert',
  'bar',
  'market',
  'other'
];

const getStatusLabel = (status: PlaceStatus | 'all') =>
  status === 'all' ? 'All status' : statusLabels[status];

const getCategoryLabel = (category: PlaceCategory | 'all') =>
  category === 'all' ? 'All places' : categoryLabels[category];

export function FilterBar({
  selectedStatus,
  selectedCategory,
  onStatusChange,
  onCategoryChange
}: FilterBarProps) {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {statusOptions.map((status) => (
            <FilterChip
              key={status}
              label={getStatusLabel(status)}
              selected={selectedStatus === status}
              onPress={() => onStatusChange(status)}
            />
          ))}
        </View>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {categoryOptions.map((category) => (
            <FilterChip
              key={category}
              label={getCategoryLabel(category)}
              selected={selectedCategory === category}
              onPress={() => onCategoryChange(category)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.selectedChip]}
    >
      <Text style={[styles.chipText, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.lg
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  selectedChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600'
  },
  selectedText: {
    color: colors.surface
  }
});
