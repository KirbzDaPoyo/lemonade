import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';
import type { PlaceCard } from '../types/place';
import { statusLabels } from '../utils/labels';
import { FavoriteMark, PlaceGlyph } from './v2-marks';

type V2PlaceRowProps = {
  density?: 'comfortable' | 'compact';
  place: PlaceCard;
  index: number;
  onPress: () => void;
};

export function V2PlaceRow({ place, index, onPress, density = 'comfortable' }: V2PlaceRowProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityHint="Opens place details"
      accessibilityLabel={`${place.placeName}, ${place.areaCity}, ${statusLabels[place.status]}${place.isFavorite ? ', favorite' : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, density === 'compact' && styles.compactRow, pressed && styles.pressed]}
    >
      <View style={[styles.indexColumn, density === 'compact' && styles.compactIndex]}>
        <Text style={styles.index}>{String(index).padStart(2, '0')}</Text>
        {density === 'comfortable' ? <PlaceGlyph label={place.placeName} outline={index % 2 === 0} /> : null}
      </View>
      <View style={styles.content}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text numberOfLines={2} style={[styles.name, density === 'compact' && styles.compactName]}>{place.placeName}</Text>
            <Text numberOfLines={1} style={styles.city}>{place.areaCity}</Text>
          </View>
          <FavoriteMark active={place.isFavorite} />
        </View>
        <Text numberOfLines={density === 'compact' ? 1 : 2} style={styles.address}>{place.address}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, place.status === 'want_to_go' && styles.wantDot, place.status === 'visited' && styles.visitedDot]} />
          <Text style={styles.statusText}>{statusLabels[place.status]}</Text>
        </View>
        {density === 'comfortable' && place.tags.length > 0 ? (
          <View style={styles.tags}>
            {place.tags.slice(0, 3).map((tag, tagIndex) => (
              <View key={tag} style={[styles.tag, tagIndex === 1 && styles.violetTag]}>
                <Text style={[styles.tagText, tagIndex === 1 && styles.violetTagText]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  compactRow: { minHeight: 100, paddingVertical: theme.spacing.sm },
  compactIndex: { width: 28 },
  compactName: { fontSize: 22, lineHeight: 26 },
  row: {
    backgroundColor: theme.colors.background,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
    minHeight: 142,
    paddingVertical: theme.spacing.lg
  },
  pressed: { opacity: 0.68 },
  indexColumn: { alignItems: 'center', gap: theme.spacing.sm, width: 62 },
  index: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 13, fontVariant: ['tabular-nums'], lineHeight: 16 },
  content: { flex: 1, gap: theme.spacing.xs, paddingRight: theme.spacing.xs },
  headingRow: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'space-between' },
  headingCopy: { flex: 1 },
  name: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 26, letterSpacing: 0.2, lineHeight: 28, textTransform: 'uppercase' },
  city: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, fontWeight: '700', lineHeight: 18 },
  address: { color: theme.colors.text, fontSize: theme.typography.body.small, lineHeight: 18 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.xs },
  statusDot: { backgroundColor: theme.colors.textSubtle, height: 7, transform: [{ rotate: '45deg' }], width: 7 },
  wantDot: { backgroundColor: theme.colors.violet },
  visitedDot: { backgroundColor: theme.colors.cobalt },
  statusText: { color: theme.colors.violet, fontFamily: theme.typography.displayFamily, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, paddingTop: theme.spacing.xs },
  tag: { borderColor: theme.colors.acidBorder, borderRadius: theme.radii.xs, borderWidth: 1, minHeight: 28, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xxs },
  tagText: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 11, letterSpacing: 0.5, lineHeight: 16, textTransform: 'uppercase' },
  violetTag: { borderColor: theme.colors.violet },
  violetTagText: { color: theme.colors.violet }
});
