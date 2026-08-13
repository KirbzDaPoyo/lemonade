import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';
import type { PlaceTag } from '../types/place';

type TagFilterBarProps = {
  tags: PlaceTag[];
  selectedTagId: string | null;
  onTagChange: (tagId: string | null) => void;
};

export function TagFilterBar({ tags, selectedTagId, onTagChange }: TagFilterBarProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (tags.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Tag filter</Text>
      <View style={styles.chips}>
        <TagChip label="All" selected={selectedTagId === null} onPress={() => onTagChange(null)} />
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

function TagChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityLabel={`Filter by ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selectedChip, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    section: { gap: theme.spacing.sm },
    label: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.label.small,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase'
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    chip: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm
    },
    selectedChip: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    chipText: { color: theme.colors.text, fontSize: theme.typography.body.small, fontWeight: '800' },
    selectedChipText: { color: theme.colors.onPrimary },
    pressed: { opacity: 0.72 }
  });
