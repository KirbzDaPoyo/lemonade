import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';

type Accent = 'primary' | 'cobalt' | 'pink' | 'violet';

export function EnergySlash({ accent = 'primary', compact = false }: { accent?: Accent; compact?: boolean }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const color = theme.colors[accent];

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.energySlash, compact && styles.energySlashCompact]}>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={[styles.energyStroke, { backgroundColor: color, left: index * (compact ? 10 : 16), width: compact ? 18 : 30 }]} />
      ))}
    </View>
  );
}

export function HazardStrip() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.hazardStrip}>
      {Array.from({ length: 12 }, (_, index) => (
        <View key={index} style={[styles.hazardSegment, { backgroundColor: index % 2 === 0 ? theme.colors.primary : theme.colors.surfaceMuted }]} />
      ))}
    </View>
  );
}

export function PlaceGlyph({ label, outline = false }: { label: string; outline?: boolean }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const letters = label.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'PL';

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.glyph, outline && styles.glyphOutline]}>
      <View style={[styles.glyphOrbit, outline && styles.glyphOrbitOutline]} />
      <View style={[styles.glyphSlash, outline && styles.glyphSlashOutline]} />
      <Text style={[styles.glyphText, outline && styles.glyphTextOutline]}>{letters}</Text>
    </View>
  );
}

export function FavoriteMark({ active, contrast = false }: { active: boolean; contrast?: boolean }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const color = contrast ? theme.colors.onPink : active ? theme.colors.pink : theme.colors.borderStrong;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.favoriteMark}>
      <View style={[styles.heartCore, { backgroundColor: color }]} />
      <View style={[styles.heartLobeLeft, { backgroundColor: color }]} />
      <View style={[styles.heartLobeRight, { backgroundColor: color }]} />
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  energySlash: { height: 40, overflow: 'hidden', position: 'relative', transform: [{ skewX: '-18deg' }], width: 82 },
  energySlashCompact: { height: 24, width: 52 },
  energyStroke: { height: 5, position: 'absolute', top: 16, transform: [{ rotate: '-18deg' }] },
  hazardStrip: { flexDirection: 'row', height: 8, overflow: 'hidden', width: '100%' },
  hazardSegment: { height: 16, marginLeft: -2, transform: [{ skewX: '-28deg' }], width: 22 },
  glyph: { alignItems: 'center', backgroundColor: theme.colors.primary, height: 58, justifyContent: 'center', overflow: 'hidden', position: 'relative', width: 58 },
  glyphOutline: { backgroundColor: 'transparent', borderColor: theme.colors.acidBorder, borderWidth: 1 },
  glyphOrbit: { borderColor: theme.colors.onPrimary, borderRadius: 18, borderWidth: 2, height: 34, position: 'absolute', transform: [{ rotate: '-18deg' }], width: 34 },
  glyphOrbitOutline: { borderColor: theme.colors.acidInk },
  glyphSlash: { backgroundColor: theme.colors.onPrimary, height: 2, position: 'absolute', transform: [{ rotate: '-32deg' }], width: 46 },
  glyphSlashOutline: { backgroundColor: theme.colors.acidInk },
  glyphText: { color: theme.colors.onPrimary, fontFamily: theme.typography.displayFamily, fontSize: 18, lineHeight: 20 },
  glyphTextOutline: { color: theme.colors.acidInk },
  favoriteMark: { height: 24, position: 'relative', transform: [{ rotate: '-45deg' }], width: 24 },
  heartCore: { height: 13, left: 5.5, position: 'absolute', top: 6.5, width: 13 },
  heartLobeLeft: { borderRadius: 7, height: 13, left: 5.5, position: 'absolute', top: 0, width: 13 },
  heartLobeRight: { borderRadius: 7, height: 13, left: 12, position: 'absolute', top: 6.5, width: 13 }
});
