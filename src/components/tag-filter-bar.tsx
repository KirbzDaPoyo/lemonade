import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';
import type { PlaceTag } from '../types/place';

type TagFilterBarProps = {
  tags: PlaceTag[];
  selectedTagId: string | null;
  onTagChange: (tagId: string | null) => void;
};

export function TagFilterBar({ tags, selectedTagId, onTagChange }: TagFilterBarProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Tags</Text>
      <View style={styles.chips}>
        <TagChip
          label="All"
          selected={selectedTagId === null}
          onPress={() => onTagChange(null)}
        />
        {tags.map((tag) => (
          <TagChip
            key={tag.id}
            label={tag.name}
            selected={selectedTagId === tag.id}
            onPress={() => onTagChange(selectedTagId === tag.id ? null : tag.id)}
          />
        ))}
      </View>
    </View>
  );
}

function TagChip({
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
      accessibilityLabel={`Filter by ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selectedChip,
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  selectedChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
  },
  selectedChipText: {
    color: colors.surface
  },
  pressed: {
    opacity: 0.78
  }
});
