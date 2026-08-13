import { forwardRef, useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle
} from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';
import { useReducedMotion } from '../design-system/use-reduced-motion';
import { V2SectionLabel } from './v2-layout';

type V2ButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'pink';
  disabled?: boolean;
  compact?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function V2Button({
  label,
  onPress,
  accessibilityLabel,
  variant = 'primary',
  disabled = false,
  compact = false,
  selected = false,
  style
}: V2ButtonProps) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scale = useRef(new Animated.Value(1)).current;

  const animateScale = (toValue: number) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      duration: theme.motion.pressMs,
      toValue,
      useNativeDriver: true
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animateScale(0.97)}
        onPressOut={() => animateScale(1)}
        style={({ pressed }) => [
          styles.button,
          compact && styles.compact,
          styles[variant],
          selected && styles.selected,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.buttonLabel,
            variant === 'primary' && styles.primaryLabel,
            variant === 'pink' && styles.pinkLabel,
            variant === 'danger' && styles.dangerLabel,
            disabled && styles.disabledLabel
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

type V2TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
};

export const V2TextField = forwardRef<TextInput, V2TextFieldProps>(
  function V2TextField({ label, hint, style, accessibilityLabel, ...inputProps }, ref) {
    const { theme } = useAppTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
      <View style={styles.fieldGroup}>
        <V2SectionLabel>{label}</V2SectionLabel>
        <TextInput
          {...inputProps}
          accessibilityLabel={accessibilityLabel ?? label}
          placeholderTextColor={theme.colors.textSubtle}
          ref={ref}
          selectionColor={theme.colors.cobalt}
          style={[styles.input, inputProps.multiline && styles.multiline, style]}
        />
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    );
  }
);

const createStyles = (theme: AppTheme) => StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radii.xs,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md
  },
  compact: { minHeight: 48, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  primary: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.background, borderColor: theme.colors.borderStrong },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: theme.colors.background, borderColor: theme.colors.danger },
  pink: { backgroundColor: theme.colors.pink, borderColor: theme.colors.pink },
  selected: { borderColor: theme.colors.primary },
  disabled: { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
  pressed: { opacity: 0.72 },
  buttonLabel: {
    color: theme.colors.text,
    fontFamily: theme.typography.displayFamily,
    fontSize: 16,
    letterSpacing: 0.7,
    textTransform: 'uppercase'
  },
  primaryLabel: { color: theme.colors.onPrimary },
  pinkLabel: { color: theme.isDark ? theme.colors.text : '#FFFFFF' },
  dangerLabel: { color: theme.colors.danger },
  disabledLabel: { color: theme.colors.textSubtle },
  fieldGroup: { gap: theme.spacing.sm },
  input: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radii.xs,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body.medium,
    lineHeight: 21,
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md
  },
  multiline: { minHeight: 112 },
  hint: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, lineHeight: 18 }
});
