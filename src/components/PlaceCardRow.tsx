import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';
import { PlaceCard } from '../types/place';
import { categoryLabels, statusLabels } from '../utils/labels';

type PlaceCardRowProps = {
  place: PlaceCard;
  onPress: () => void;
};

export function PlaceCardRow({ place, onPress }: PlaceCardRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleColumn}>
          <Text numberOfLines={1} style={styles.name}>
            {place.placeName}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {categoryLabels[place.category]} - {place.areaCity}
          </Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusLabels[place.status]}</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.address}>
        {place.address}
      </Text>
      <View style={styles.tagRow}>
        {place.tags.slice(0, 3).map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  pressed: {
    opacity: 0.82
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between'
  },
  titleColumn: {
    flex: 1,
    gap: spacing.xs
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  meta: {
    color: colors.muted,
    fontSize: 14
  },
  address: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20
  },
  statusPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  statusText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800'
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  tag: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  tagText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700'
  }
});
