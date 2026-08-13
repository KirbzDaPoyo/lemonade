import { forwardRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View
} from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';

type AppTextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
};

export const AppTextField = forwardRef<TextInput, AppTextFieldProps>(
  function AppTextField({ label, hint, style, accessibilityLabel, ...inputProps }, ref) {
    const { theme } = useAppTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
      <View style={styles.group}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          {...inputProps}
          accessibilityLabel={accessibilityLabel ?? label}
          ref={ref}
          placeholderTextColor={theme.colors.textSubtle}
          selectionColor={theme.colors.cobalt}
          style={[styles.input, inputProps.multiline && styles.multiline, style]}
        />
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    );
  }
);

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    group: {
      gap: theme.spacing.sm
    },
    label: {
      color: theme.colors.text,
      fontSize: theme.typography.label.medium,
      fontWeight: '800',
      letterSpacing: 0.3
    },
    input: {
      backgroundColor: theme.colors.input,
      borderColor: theme.colors.borderStrong,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      color: theme.colors.text,
      fontSize: theme.typography.body.large,
      minHeight: 52,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md
    },
    multiline: {
      minHeight: 120
    },
    hint: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.body.small,
      lineHeight: 18
    }
  });
