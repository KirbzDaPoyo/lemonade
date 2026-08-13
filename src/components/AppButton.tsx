import { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';
import { useReducedMotion } from '../design-system/use-reduced-motion';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({ label, onPress, variant = 'primary', disabled = false, compact = false, style }: AppButtonProps) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scale = useRef(new Animated.Value(1)).current;

  const animateScale = (toValue: number) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, { duration: theme.motion.pressMs, toValue, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animateScale(0.985)}
        onPressOut={() => animateScale(1)}
        style={({ pressed }) => [styles.base, styles[variant], compact && styles.compact, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      >
        <Text style={[styles.label, variant === 'primary' && styles.primaryLabel, variant === 'danger' && styles.dangerLabel, variant === 'ghost' && styles.ghostLabel, disabled && styles.disabledLabel]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  base: { alignItems: 'center', backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.sm, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  compact: { minHeight: 48, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  primary: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.surface },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: theme.colors.dangerSurface, borderColor: theme.colors.danger },
  disabled: { backgroundColor: theme.colors.disabledSurface, borderColor: theme.colors.border },
  pressed: { opacity: 0.78 },
  label: { color: theme.colors.text, fontSize: theme.typography.label.large, fontWeight: '800', letterSpacing: 0.2 },
  primaryLabel: { color: theme.colors.onPrimary },
  dangerLabel: { color: theme.colors.danger },
  ghostLabel: { color: theme.colors.textMuted },
  disabledLabel: { color: theme.colors.disabledText }
});
