import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';
import { PlaceCard } from '../types/place';
import { favoriteLabel, statusLabels } from '../utils/labels';

type PlaceCardRowProps = { place: PlaceCard; onPress: () => void };

export function PlaceCardRow({ place, onPress }: PlaceCardRowProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.indexRail} />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.titleColumn}>
            <Text numberOfLines={2} style={styles.name}>{place.placeName}</Text>
            <Text numberOfLines={1} style={styles.meta}>{place.areaCity}</Text>
          </View>
          <View style={[styles.status, place.isFavorite && styles.favoriteStatus]}>
            <Text style={[styles.statusText, place.isFavorite && styles.favoriteText]}>
              {place.isFavorite ? `${favoriteLabel} / ` : ''}{statusLabels[place.status]}
            </Text>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.address}>{place.address}</Text>
        {place.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {place.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      minHeight: 148
    },
    pressed: { opacity: 0.7 },
    indexRail: { backgroundColor: theme.colors.primary, width: 3 },
    content: { flex: 1, gap: theme.spacing.md, padding: theme.spacing.lg },
    headerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.md },
    titleColumn: { flex: 1, gap: theme.spacing.xs },
    name: {
      color: theme.colors.text,
      fontFamily: theme.typography.displayFamily,
      fontSize: 26,
      letterSpacing: 0.1,
      lineHeight: 27,
      textTransform: 'uppercase'
    },
    meta: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, fontWeight: '700' },
    address: { color: theme.colors.text, fontSize: theme.typography.body.medium, lineHeight: 21 },
    status: { borderColor: theme.colors.borderStrong, borderRadius: theme.radii.xs, borderWidth: 1, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs },
    favoriteStatus: { borderColor: theme.colors.pink },
    statusText: { color: theme.colors.textMuted, fontSize: theme.typography.label.small, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
    favoriteText: { color: theme.colors.pink },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    tag: { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.xs, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs },
    tagText: { color: theme.colors.textMuted, fontSize: theme.typography.label.small, fontWeight: '800' }
  });
