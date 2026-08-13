import { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';
import { useReducedMotion } from '../design-system/use-reduced-motion';
import { EnergySlash } from './v2-marks';

type V2TopBarProps = {
  onBack?: () => void;
  onHome?: () => void;
  brand?: boolean;
  trailing?: React.ReactNode;
};

export function V2TopBar({ onBack, onHome, brand = false, trailing }: V2TopBarProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.topBar}>
      {onBack ? <V2IconButton accessibilityLabel="Back" icon="back" onPress={onBack} /> : (
        <Text style={styles.brand}>{brand ? 'LEMONADE' : ''}</Text>
      )}
      <View style={styles.topBarRight}>
        {onHome ? <V2IconButton accessibilityLabel="Home" icon="home" onPress={onHome} /> : null}
        {trailing}
      </View>
    </View>
  );
}

export function V2TitleBlock({ title, subtitle, decorated = true }: { title: string; subtitle?: string; decorated?: boolean }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.titleBlock}>
      <View style={styles.titleRow}>
        <Text adjustsFontSizeToFit numberOfLines={2} style={styles.screenTitle}>{title}</Text>
        {decorated ? <EnergySlash compact /> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function V2SectionLabel({ children, color = 'primary' }: { children: React.ReactNode; color?: 'primary' | 'pink' | 'cobalt' | 'violet' }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedColor = color === 'primary' ? theme.colors.acidInk : theme.colors[color];
  return <Text style={[styles.sectionLabel, { color: resolvedColor }]}>{children}</Text>;
}

export function V2Console({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.consoleGroup}>
      <V2SectionLabel>{label}</V2SectionLabel>
      <View style={styles.console}>{children}</View>
    </View>
  );
}

function V2IconButton({ accessibilityLabel, icon, onPress }: { accessibilityLabel: string; icon: 'back' | 'home'; onPress: () => void }) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => {
    if (reduceMotion) return;
    Animated.timing(scale, { duration: theme.motion.pressMs, toValue, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        hitSlop={4}
        onPress={onPress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={({ pressed }) => [styles.iconTouch, pressed && styles.pressed]}
      >
        <View style={styles.iconFrame}>
          {icon === 'back' ? <BackMark /> : <HomeMark />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function BackMark() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={styles.backMark}><View style={styles.backStem} /><View style={styles.backHeadTop} /><View style={styles.backHeadBottom} /></View>;
}

function HomeMark() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={styles.homeMark}><View style={styles.homeRoofLeft} /><View style={styles.homeRoofRight} /><View style={styles.homeBody} /></View>;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  topBar: { alignItems: 'center', borderBottomColor: theme.colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52 },
  topBarRight: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.xs },
  brand: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 16, fontStyle: 'italic', letterSpacing: 0.8 },
  titleBlock: { gap: theme.spacing.xs },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 52 },
  screenTitle: { color: theme.colors.text, flexShrink: 1, fontFamily: theme.typography.displayFamily, fontSize: 42, letterSpacing: -0.6, lineHeight: 44, textTransform: 'uppercase' },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.typography.body.medium, lineHeight: 21 },
  sectionLabel: { fontFamily: theme.typography.displayFamily, fontSize: 13, letterSpacing: 0.9, lineHeight: 16, textTransform: 'uppercase' },
  consoleGroup: { gap: theme.spacing.sm },
  console: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, borderWidth: 1, minHeight: 64, padding: theme.spacing.md },
  iconTouch: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  iconFrame: { alignItems: 'center', borderColor: theme.colors.acidBorder, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
  pressed: { opacity: 0.7 },
  backMark: { height: 14, position: 'relative', width: 16 },
  backStem: { backgroundColor: theme.colors.acidInk, height: 1.5, left: 2, position: 'absolute', top: 6, width: 13 },
  backHeadTop: { backgroundColor: theme.colors.acidInk, height: 1.5, left: 1, position: 'absolute', top: 3, transform: [{ rotate: '-42deg' }], width: 7 },
  backHeadBottom: { backgroundColor: theme.colors.acidInk, height: 1.5, left: 1, position: 'absolute', top: 9, transform: [{ rotate: '42deg' }], width: 7 },
  homeMark: { height: 16, position: 'relative', width: 17 },
  homeRoofLeft: { backgroundColor: theme.colors.acidInk, height: 1.5, left: 1, position: 'absolute', top: 4, transform: [{ rotate: '-38deg' }], width: 10 },
  homeRoofRight: { backgroundColor: theme.colors.acidInk, height: 1.5, left: 7, position: 'absolute', top: 4, transform: [{ rotate: '38deg' }], width: 10 },
  homeBody: { borderBottomColor: theme.colors.acidInk, borderBottomWidth: 1.5, borderLeftColor: theme.colors.acidInk, borderLeftWidth: 1.5, borderRightColor: theme.colors.acidInk, borderRightWidth: 1.5, bottom: 0, height: 10, left: 3, position: 'absolute', width: 11 }
});
