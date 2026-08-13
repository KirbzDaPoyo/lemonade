import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';

export function StorageErrorBanner({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <View style={styles.copy}>
        <Text style={styles.title}>Storage issue</Text>
        <Text style={styles.body}>{message}</Text>
      </View>
      {onRetry ? (
        <Pressable
          accessibilityLabel="Retry storage connection"
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={styles.retryLabel}>RETRY</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    banner: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.dangerSurface,
      borderColor: theme.colors.danger,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.md,
      padding: theme.spacing.lg
    },
    copy: { flex: 1, gap: theme.spacing.xs },
    title: {
      color: theme.colors.danger,
      fontFamily: theme.typography.displayFamily,
      fontSize: 18,
      letterSpacing: 0.4,
      textTransform: 'uppercase'
    },
    body: {
      color: theme.colors.text,
      fontSize: theme.typography.body.small,
      lineHeight: 19
    },
    retry: {
      alignItems: 'center',
      borderColor: theme.colors.danger,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 48,
      minWidth: 72,
      paddingHorizontal: theme.spacing.sm
    },
    retryLabel: {
      color: theme.colors.danger,
      fontFamily: theme.typography.displayFamily,
      fontSize: 12,
      letterSpacing: 0.6
    },
    pressed: { opacity: 0.68 }
  });